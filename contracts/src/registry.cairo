use starknet::ContractAddress;

#[starknet::interface]
pub trait IRegistry<TContractState> {
    fn register(
        ref self: TContractState,
        spending_pub_x: felt252,
        spending_pub_y: felt252,
        viewing_pub_x: felt252,
        viewing_pub_y: felt252,
    );
    fn get_meta_address(
        self: @TContractState, user: ContractAddress,
    ) -> (felt252, felt252, felt252, felt252);
    fn is_registered(self: @TContractState, user: ContractAddress) -> bool;
}

#[starknet::contract]
mod Registry {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        // user -> (spending_pub_x, spending_pub_y, viewing_pub_x, viewing_pub_y)
        spending_pub_x: Map<ContractAddress, felt252>,
        spending_pub_y: Map<ContractAddress, felt252>,
        viewing_pub_x: Map<ContractAddress, felt252>,
        viewing_pub_y: Map<ContractAddress, felt252>,
        registered: Map<ContractAddress, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        MetaAddressRegistered: MetaAddressRegistered,
    }

    #[derive(Drop, starknet::Event)]
    struct MetaAddressRegistered {
        #[key]
        user: ContractAddress,
        spending_pub_x: felt252,
        spending_pub_y: felt252,
        viewing_pub_x: felt252,
        viewing_pub_y: felt252,
    }

    #[abi(embed_v0)]
    impl RegistryImpl of super::IRegistry<ContractState> {
        fn register(
            ref self: ContractState,
            spending_pub_x: felt252,
            spending_pub_y: felt252,
            viewing_pub_x: felt252,
            viewing_pub_y: felt252,
        ) {
            let caller = get_caller_address();
            self.spending_pub_x.write(caller, spending_pub_x);
            self.spending_pub_y.write(caller, spending_pub_y);
            self.viewing_pub_x.write(caller, viewing_pub_x);
            self.viewing_pub_y.write(caller, viewing_pub_y);
            self.registered.write(caller, true);

            self.emit(MetaAddressRegistered {
                user: caller,
                spending_pub_x,
                spending_pub_y,
                viewing_pub_x,
                viewing_pub_y,
            });
        }

        fn get_meta_address(
            self: @ContractState, user: ContractAddress,
        ) -> (felt252, felt252, felt252, felt252) {
            assert!(self.registered.read(user), "User not registered");
            (
                self.spending_pub_x.read(user),
                self.spending_pub_y.read(user),
                self.viewing_pub_x.read(user),
                self.viewing_pub_y.read(user),
            )
        }

        fn is_registered(self: @ContractState, user: ContractAddress) -> bool {
            self.registered.read(user)
        }
    }
}
