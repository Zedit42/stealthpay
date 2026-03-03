use starknet::ContractAddress;

#[starknet::interface]
pub trait IStealthVault<TContractState> {
    fn send_to_stealth(
        ref self: TContractState,
        stealth_address: ContractAddress,
        ephemeral_pub_x: felt252,
        ephemeral_pub_y: felt252,
        token: ContractAddress,
        amount: u256,
    );
    fn get_payment_count(self: @TContractState) -> u64;
    fn get_payment(self: @TContractState, index: u64) -> (felt252, felt252, ContractAddress, ContractAddress, u256);
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
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use super::{IERC20Dispatcher, IERC20DispatcherTrait};

    #[storage]
    struct Storage {
        ephemeral_pub_x: Map<u64, felt252>,
        ephemeral_pub_y: Map<u64, felt252>,
        ephemeral_stealth_addr: Map<u64, ContractAddress>,
        ephemeral_token: Map<u64, ContractAddress>,
        ephemeral_amount: Map<u64, u256>,
        payment_count: u64,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        StealthPayment: StealthPayment,
    }

    #[derive(Drop, starknet::Event)]
    pub struct StealthPayment {
        #[key]
        pub stealth_address: ContractAddress,
        pub ephemeral_pub_x: felt252,
        pub ephemeral_pub_y: felt252,
        pub token: ContractAddress,
        pub amount: u256,
        pub index: u64,
    }

    #[abi(embed_v0)]
    impl StealthVaultImpl of super::IStealthVault<ContractState> {
        fn send_to_stealth(
            ref self: ContractState,
            stealth_address: ContractAddress,
            ephemeral_pub_x: felt252,
            ephemeral_pub_y: felt252,
            token: ContractAddress,
            amount: u256,
        ) {
            assert!(amount > 0, "Amount must be > 0");
            assert!(ephemeral_pub_x != 0, "Invalid ephemeral key");

            // Transfer tokens from sender to stealth address directly
            let caller = get_caller_address();
            let token_dispatcher = IERC20Dispatcher { contract_address: token };
            token_dispatcher.transfer_from(caller, stealth_address, amount);

            // Log ephemeral key for receiver scanning
            let index = self.payment_count.read();
            self.ephemeral_pub_x.write(index, ephemeral_pub_x);
            self.ephemeral_pub_y.write(index, ephemeral_pub_y);
            self.ephemeral_stealth_addr.write(index, stealth_address);
            self.ephemeral_token.write(index, token);
            self.ephemeral_amount.write(index, amount);
            self.payment_count.write(index + 1);

            self.emit(StealthPayment {
                stealth_address,
                ephemeral_pub_x,
                ephemeral_pub_y,
                token,
                amount,
                index,
            });
        }

        fn get_payment_count(self: @ContractState) -> u64 {
            self.payment_count.read()
        }

        fn get_payment(self: @ContractState, index: u64) -> (felt252, felt252, ContractAddress, ContractAddress, u256) {
            assert!(index < self.payment_count.read(), "Index out of bounds");
            (
                self.ephemeral_pub_x.read(index),
                self.ephemeral_pub_y.read(index),
                self.ephemeral_stealth_addr.read(index),
                self.ephemeral_token.read(index),
                self.ephemeral_amount.read(index),
            )
        }
    }
}
