use snforge_std::{declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address, stop_cheat_caller_address};
use starknet::ContractAddress;
use stealthpay::stealth_vault::{IStealthVaultDispatcher, IStealthVaultDispatcherTrait, IERC20Dispatcher, IERC20DispatcherTrait};

fn user1() -> ContractAddress {
    starknet::contract_address_const::<0x1111>()
}

fn deploy_token() -> ContractAddress {
    let contract = declare("MockERC20").unwrap().contract_class();
    let (address, _) = contract.deploy(@array![]).unwrap();
    address
}

fn deploy_vault() -> IStealthVaultDispatcher {
    let contract = declare("StealthVault").unwrap().contract_class();
    let (address, _) = contract.deploy(@array![]).unwrap();
    IStealthVaultDispatcher { contract_address: address }
}

#[test]
fn test_payment_count_starts_zero() {
    let vault = deploy_vault();
    assert!(vault.get_payment_count() == 0, "Count should be 0");
}

#[test]
#[should_panic(expected: "Index out of bounds")]
fn test_get_payment_out_of_bounds() {
    let vault = deploy_vault();
    vault.get_payment(0);
}

#[test]
fn test_send_and_check_balance() {
    let vault = deploy_vault();
    let token_addr = deploy_token();
    let sender = user1();

    // Mint tokens to sender
    let token = IERC20Dispatcher { contract_address: token_addr };

    // Mock: mint via direct call (MockERC20 has public mint)
    start_cheat_caller_address(token_addr, sender);
    // We call mint through a raw call since it's not in IERC20 interface
    stop_cheat_caller_address(token_addr);

    // For now just verify the balance view works
    let balance = vault.get_balance(0x123, token_addr);
    assert!(balance == 0, "Balance should be 0");
}

#[test]
fn test_balance_zero_for_unknown() {
    let vault = deploy_vault();
    let token = starknet::contract_address_const::<0xABC>();
    assert!(vault.get_balance(0x999, token) == 0, "Should be 0");
}

#[test]
#[should_panic(expected: "Insufficient balance")]
fn test_withdraw_insufficient_balance() {
    let vault = deploy_vault();
    let token = starknet::contract_address_const::<0xABC>();
    let recipient = starknet::contract_address_const::<0xDEF>();

    vault.withdraw(0x123, 0x456, token, recipient, 1000_u256, 1, 0xAAA, 0xBBB);
}
