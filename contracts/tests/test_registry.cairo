use snforge_std::{declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address, stop_cheat_caller_address};
use starknet::ContractAddress;
use stealthpay::registry::{IRegistryDispatcher, IRegistryDispatcherTrait};

fn deploy_registry() -> IRegistryDispatcher {
    let contract = declare("Registry").unwrap().contract_class();
    let (contract_address, _) = contract.deploy(@array![]).unwrap();
    IRegistryDispatcher { contract_address }
}

fn user1() -> ContractAddress {
    starknet::contract_address_const::<0x1234>()
}

#[test]
fn test_register_and_get() {
    let registry = deploy_registry();
    let user = user1();

    start_cheat_caller_address(registry.contract_address, user);
    registry.register(0x111, 0x222, 0x333, 0x444);
    stop_cheat_caller_address(registry.contract_address);

    let (sx, sy, vx, vy) = registry.get_meta_address(user);
    assert!(sx == 0x111, "spending_x mismatch");
    assert!(sy == 0x222, "spending_y mismatch");
    assert!(vx == 0x333, "viewing_x mismatch");
    assert!(vy == 0x444, "viewing_y mismatch");
}

#[test]
fn test_is_registered() {
    let registry = deploy_registry();
    let user = user1();

    assert!(!registry.is_registered(user), "Should not be registered yet");

    start_cheat_caller_address(registry.contract_address, user);
    registry.register(0x111, 0x222, 0x333, 0x444);
    stop_cheat_caller_address(registry.contract_address);

    assert!(registry.is_registered(user), "Should be registered");
}

#[test]
fn test_update_registration() {
    let registry = deploy_registry();
    let user = user1();

    start_cheat_caller_address(registry.contract_address, user);
    registry.register(0x111, 0x222, 0x333, 0x444);
    registry.register(0xAAA, 0xBBB, 0xCCC, 0xDDD);
    stop_cheat_caller_address(registry.contract_address);

    let (sx, _, _, _) = registry.get_meta_address(user);
    assert!(sx == 0xAAA, "Should be updated");
}

#[test]
#[should_panic(expected: "User not registered")]
fn test_get_unregistered_panics() {
    let registry = deploy_registry();
    let user = user1();
    registry.get_meta_address(user);
}

#[test]
#[should_panic(expected: "Invalid spending key x")]
fn test_register_zero_spending_panics() {
    let registry = deploy_registry();
    let user = user1();
    start_cheat_caller_address(registry.contract_address, user);
    registry.register(0, 0x222, 0x333, 0x444);
}
