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
    fn get_ephemeral_key(self: @TContractState, index: u64) -> (felt252, felt252);
}

#[starknet::contract]
mod StealthVault {
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};

    // ERC20 interface for token transfers
    #[starknet::interface]
    trait IERC20<TContractState> {
        fn transfer_from(
            ref self: TContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool;
    }

    #[storage]
    struct Storage {
        // Ephemeral keys log (for receiver scanning)
        ephemeral_pub_x: Map<u64, felt252>,
        ephemeral_pub_y: Map<u64, felt252>,
        ephemeral_stealth_addr: Map<u64, ContractAddress>,
        ephemeral_token: Map<u64, ContractAddress>,
        ephemeral_amount: Map<u64, u256>,
        payment_count: u64,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        StealthPayment: StealthPayment,
    }

    #[derive(Drop, starknet::Event)]
    struct StealthPayment {
        #[key]
        stealth_address: ContractAddress,
        ephemeral_pub_x: felt252,
        ephemeral_pub_y: felt252,
        token: ContractAddress,
        amount: u256,
        index: u64,
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

            // Transfer tokens from sender to stealth address
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

        fn get_ephemeral_key(self: @ContractState, index: u64) -> (felt252, felt252) {
            (self.ephemeral_pub_x.read(index), self.ephemeral_pub_y.read(index))
        }
    }
}
