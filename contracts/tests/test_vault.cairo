use snforge_std::{declare, ContractClassTrait, DeclareResultTrait};
use stealthpay::stealth_vault::{IStealthVaultDispatcher, IStealthVaultDispatcherTrait};

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
