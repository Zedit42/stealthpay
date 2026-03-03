use starknet::ContractAddress;

/// Withdrawal message struct for signature verification
#[derive(Drop, Copy, Hash)]
pub struct WithdrawalRequest {
    pub stealth_pub_x: felt252,
    pub stealth_pub_y: felt252,
    pub token: ContractAddress,
    pub recipient: ContractAddress,
    pub amount: u256,
    pub nonce: felt252,
}

#[starknet::interface]
pub trait IWithdrawal<TContractState> {
    /// Withdraw funds by proving ownership of stealth private key via signature.
    /// Anyone can submit this tx (relayer-friendly) — privacy preserved.
    fn withdraw_with_sig(
        ref self: TContractState,
        stealth_pub_x: felt252,
        stealth_pub_y: felt252,
        token: ContractAddress,
        recipient: ContractAddress,
        amount: u256,
        nonce: felt252,
        sig_r: felt252,
        sig_s: felt252,
    );
    fn is_nonce_used(self: @TContractState, nonce: felt252) -> bool;
}

#[starknet::contract]
pub mod Withdrawal {
    use starknet::ContractAddress;
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::poseidon::PoseidonTrait;
    use core::hash::{HashStateTrait, HashStateExTrait};
    use super::super::stealth_vault::{IERC20Dispatcher, IERC20DispatcherTrait};

    #[storage]
    struct Storage {
        used_nonces: Map<felt252, bool>,
        vault_address: felt252,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        StealthWithdrawal: StealthWithdrawal,
    }

    #[derive(Drop, starknet::Event)]
    pub struct StealthWithdrawal {
        #[key]
        pub stealth_pub_x: felt252,
        pub recipient: ContractAddress,
        pub token: ContractAddress,
        pub amount: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, vault: felt252) {
        self.vault_address.write(vault);
    }

    /// Hash the withdrawal request using Poseidon
    fn hash_withdrawal(
        stealth_pub_x: felt252,
        stealth_pub_y: felt252,
        token: ContractAddress,
        recipient: ContractAddress,
        amount: u256,
        nonce: felt252,
    ) -> felt252 {
        let token_felt: felt252 = token.into();
        let recipient_felt: felt252 = recipient.into();
        PoseidonTrait::new()
            .update(stealth_pub_x)
            .update(stealth_pub_y)
            .update(token_felt)
            .update(recipient_felt)
            .update(amount.low.into())
            .update(amount.high.into())
            .update(nonce)
            .finalize()
    }

    #[abi(embed_v0)]
    impl WithdrawalImpl of super::IWithdrawal<ContractState> {
        fn withdraw_with_sig(
            ref self: ContractState,
            stealth_pub_x: felt252,
            stealth_pub_y: felt252,
            token: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
            nonce: felt252,
            sig_r: felt252,
            sig_s: felt252,
        ) {
            // 1. Check nonce not used (replay protection)
            assert!(!self.used_nonces.read(nonce), "Nonce already used");

            // 2. Hash the withdrawal request
            let msg_hash = hash_withdrawal(
                stealth_pub_x, stealth_pub_y, token, recipient, amount, nonce,
            );

            // 3. Verify ECDSA signature against stealth public key
            let is_valid = core::ecdsa::check_ecdsa_signature(
                msg_hash, stealth_pub_x, sig_r, sig_s,
            );
            assert!(is_valid, "Invalid signature");

            // 4. Mark nonce as used
            self.used_nonces.write(nonce, true);

            // 5. Emit event
            self.emit(StealthWithdrawal {
                stealth_pub_x,
                recipient,
                token,
                amount,
            });

            // Note: In production, the stealth address is an AA wallet.
            // The token transfer would be initiated by the stealth wallet itself
            // after verifying this withdrawal authorization.
            // For the hackathon MVP, we emit the event and the frontend
            // handles the actual transfer via the stealth wallet's AA capabilities.
        }

        fn is_nonce_used(self: @ContractState, nonce: felt252) -> bool {
            self.used_nonces.read(nonce)
        }
    }
}
