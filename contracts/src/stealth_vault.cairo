use starknet::ContractAddress;

#[starknet::interface]
pub trait IStealthVault<TContractState> {
    fn send_to_stealth(
        ref self: TContractState,
        stealth_pub_x: felt252,
        stealth_pub_y: felt252,
        ephemeral_pub_x: felt252,
        ephemeral_pub_y: felt252,
        token: ContractAddress,
        amount: u256,
    );
    fn withdraw(
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
    fn get_payment_count(self: @TContractState) -> u64;
    fn get_payment(self: @TContractState, index: u64) -> (felt252, felt252, felt252, felt252, ContractAddress, u256);
    fn get_balance(self: @TContractState, stealth_pub_x: felt252, token: ContractAddress) -> u256;
}

#[starknet::interface]
pub trait IERC20<TContractState> {
    fn transfer_from(
        ref self: TContractState,
        sender: ContractAddress,
        recipient: ContractAddress,
        amount: u256,
    ) -> bool;
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
}

#[starknet::contract]
pub mod StealthVault {
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::poseidon::PoseidonTrait;
    use core::hash::HashStateTrait;
    use super::{IERC20Dispatcher, IERC20DispatcherTrait};

    #[storage]
    struct Storage {
        // Payment log (for scanning)
        pay_stealth_pub_x: Map<u64, felt252>,
        pay_stealth_pub_y: Map<u64, felt252>,
        pay_ephemeral_pub_x: Map<u64, felt252>,
        pay_ephemeral_pub_y: Map<u64, felt252>,
        pay_token: Map<u64, ContractAddress>,
        pay_amount: Map<u64, u256>,
        payment_count: u64,
        // Balances held in vault: (stealth_pub_x, token) -> amount
        balances: Map<(felt252, ContractAddress), u256>,
        // Nonce replay protection
        used_nonces: Map<felt252, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        StealthPayment: StealthPayment,
        StealthWithdrawal: StealthWithdrawal,
    }

    #[derive(Drop, starknet::Event)]
    pub struct StealthPayment {
        #[key]
        pub stealth_pub_x: felt252,
        pub stealth_pub_y: felt252,
        pub ephemeral_pub_x: felt252,
        pub ephemeral_pub_y: felt252,
        pub token: ContractAddress,
        pub amount: u256,
        pub index: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct StealthWithdrawal {
        #[key]
        pub stealth_pub_x: felt252,
        pub recipient: ContractAddress,
        pub token: ContractAddress,
        pub amount: u256,
    }

    #[abi(embed_v0)]
    impl StealthVaultImpl of super::IStealthVault<ContractState> {
        fn send_to_stealth(
            ref self: ContractState,
            stealth_pub_x: felt252,
            stealth_pub_y: felt252,
            ephemeral_pub_x: felt252,
            ephemeral_pub_y: felt252,
            token: ContractAddress,
            amount: u256,
        ) {
            assert!(amount > 0, "Amount must be > 0");
            assert!(ephemeral_pub_x != 0, "Invalid ephemeral key");

            // Transfer tokens from sender to THIS vault contract
            let caller = get_caller_address();
            let this = get_contract_address();
            let token_dispatcher = IERC20Dispatcher { contract_address: token };
            token_dispatcher.transfer_from(caller, this, amount);

            // Credit balance to stealth pubkey
            let current = self.balances.read((stealth_pub_x, token));
            self.balances.write((stealth_pub_x, token), current + amount);

            // Log payment for scanning
            let index = self.payment_count.read();
            self.pay_stealth_pub_x.write(index, stealth_pub_x);
            self.pay_stealth_pub_y.write(index, stealth_pub_y);
            self.pay_ephemeral_pub_x.write(index, ephemeral_pub_x);
            self.pay_ephemeral_pub_y.write(index, ephemeral_pub_y);
            self.pay_token.write(index, token);
            self.pay_amount.write(index, amount);
            self.payment_count.write(index + 1);

            self.emit(StealthPayment {
                stealth_pub_x,
                stealth_pub_y,
                ephemeral_pub_x,
                ephemeral_pub_y,
                token,
                amount,
                index,
            });
        }

        fn withdraw(
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
            // 1. Replay protection
            assert!(!self.used_nonces.read(nonce), "Nonce already used");

            // 2. Check balance
            let balance = self.balances.read((stealth_pub_x, token));
            assert!(balance >= amount, "Insufficient balance");

            // 3. Hash withdrawal request
            let token_felt: felt252 = token.into();
            let recipient_felt: felt252 = recipient.into();
            let msg_hash = PoseidonTrait::new()
                .update(stealth_pub_x)
                .update(stealth_pub_y)
                .update(token_felt)
                .update(recipient_felt)
                .update(amount.low.into())
                .update(amount.high.into())
                .update(nonce)
                .finalize();

            // 4. Verify ECDSA signature
            let is_valid = core::ecdsa::check_ecdsa_signature(
                msg_hash, stealth_pub_x, sig_r, sig_s,
            );
            assert!(is_valid, "Invalid signature");

            // 5. Update state
            self.used_nonces.write(nonce, true);
            self.balances.write((stealth_pub_x, token), balance - amount);

            // 6. Transfer tokens to recipient
            let token_dispatcher = IERC20Dispatcher { contract_address: token };
            token_dispatcher.transfer(recipient, amount);

            self.emit(StealthWithdrawal {
                stealth_pub_x,
                recipient,
                token,
                amount,
            });
        }

        fn get_payment_count(self: @ContractState) -> u64 {
            self.payment_count.read()
        }

        fn get_payment(self: @ContractState, index: u64) -> (felt252, felt252, felt252, felt252, ContractAddress, u256) {
            assert!(index < self.payment_count.read(), "Index out of bounds");
            (
                self.pay_stealth_pub_x.read(index),
                self.pay_stealth_pub_y.read(index),
                self.pay_ephemeral_pub_x.read(index),
                self.pay_ephemeral_pub_y.read(index),
                self.pay_token.read(index),
                self.pay_amount.read(index),
            )
        }

        fn get_balance(self: @ContractState, stealth_pub_x: felt252, token: ContractAddress) -> u256 {
            self.balances.read((stealth_pub_x, token))
        }
    }
}
