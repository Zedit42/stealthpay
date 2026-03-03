use starknet::ContractAddress;

#[starknet::interface]
pub trait IWithdrawal<TContractState> {
    /// Withdraw funds from a stealth address to any recipient.
    /// In Phase 3, this will require a ZK proof of ownership.
    /// For now (Phase 1), it uses simple signature-based auth.
    fn withdraw(
        ref self: TContractState,
        stealth_address: ContractAddress,
        recipient: ContractAddress,
        token: ContractAddress,
        amount: u256,
    );
}

#[starknet::contract]
mod Withdrawal {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};

    #[starknet::interface]
    trait IERC20<TContractState> {
        fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
        fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    }

    #[storage]
    struct Storage {
        // Track which stealth addresses have been withdrawn
        withdrawn: Map<ContractAddress, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        StealthWithdrawal: StealthWithdrawal,
    }

    #[derive(Drop, starknet::Event)]
    struct StealthWithdrawal {
        #[key]
        stealth_address: ContractAddress,
        recipient: ContractAddress,
        token: ContractAddress,
        amount: u256,
    }

    #[abi(embed_v0)]
    impl WithdrawalImpl of super::IWithdrawal<ContractState> {
        fn withdraw(
            ref self: ContractState,
            stealth_address: ContractAddress,
            recipient: ContractAddress,
            token: ContractAddress,
            amount: u256,
        ) {
            // Phase 1: Only the stealth address owner can withdraw (caller = stealth)
            // Phase 3: Will replace with ZK proof verification
            let caller = get_caller_address();
            assert!(caller == stealth_address, "Only stealth address owner can withdraw");
            assert!(!self.withdrawn.read(stealth_address), "Already withdrawn");

            self.withdrawn.write(stealth_address, true);

            self.emit(StealthWithdrawal {
                stealth_address,
                recipient,
                token,
                amount,
            });

            // Note: Actual token transfer happens from the stealth address
            // In production, the stealth address is an AA wallet that executes this
        }
    }
}
