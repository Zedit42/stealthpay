use starknet::ContractAddress;

#[starknet::interface]
pub trait IWithdrawal<TContractState> {
    fn withdraw(
        ref self: TContractState,
        token: ContractAddress,
        recipient: ContractAddress,
        amount: u256,
    );
    fn is_withdrawn(self: @TContractState, stealth_address: ContractAddress) -> bool;
}

/// Withdrawal contract — called BY the stealth address (AA wallet) to move funds out.
/// Phase 1: caller == stealth address (simple auth)
/// Phase 3: will add ZK proof of ownership
#[starknet::contract]
pub mod Withdrawal {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use super::super::stealth_vault::{IERC20Dispatcher, IERC20DispatcherTrait};

    #[storage]
    struct Storage {
        withdrawn: Map<ContractAddress, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        StealthWithdrawal: StealthWithdrawal,
    }

    #[derive(Drop, starknet::Event)]
    pub struct StealthWithdrawal {
        #[key]
        pub stealth_address: ContractAddress,
        pub recipient: ContractAddress,
        pub token: ContractAddress,
        pub amount: u256,
    }

    #[abi(embed_v0)]
    impl WithdrawalImpl of super::IWithdrawal<ContractState> {
        fn withdraw(
            ref self: ContractState,
            token: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) {
            let caller = get_caller_address();
            assert!(!self.withdrawn.read(caller), "Already withdrawn");
            assert!(amount > 0, "Amount must be > 0");

            // Mark as withdrawn (prevents double-withdraw)
            self.withdrawn.write(caller, true);

            // Transfer tokens from stealth address (caller) to recipient
            // The stealth address must have approved this contract or call directly
            let token_dispatcher = IERC20Dispatcher { contract_address: token };
            token_dispatcher.transfer_from(caller, recipient, amount);

            self.emit(StealthWithdrawal {
                stealth_address: caller,
                recipient,
                token,
                amount,
            });
        }

        fn is_withdrawn(self: @ContractState, stealth_address: ContractAddress) -> bool {
            self.withdrawn.read(stealth_address)
        }
    }
}
