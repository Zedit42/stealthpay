use snforge_std::{declare, ContractClassTrait, DeclareResultTrait};
use starknet::ContractAddress;
use stealthpay::withdrawal::{IWithdrawalDispatcher, IWithdrawalDispatcherTrait};

fn vault_addr() -> ContractAddress {
    starknet::contract_address_const::<0xAA01>()
}

fn deploy_withdrawal() -> IWithdrawalDispatcher {
    let contract = declare("Withdrawal").unwrap().contract_class();
    let (address, _) = contract.deploy(@array![0xAA01]).unwrap();
    IWithdrawalDispatcher { contract_address: address }
}

#[test]
fn test_nonce_starts_unused() {
    let w = deploy_withdrawal();
    assert!(!w.is_nonce_used(42), "Nonce should not be used");
}

#[test]
#[should_panic(expected: "Invalid signature")]
fn test_invalid_signature_panics() {
    let w = deploy_withdrawal();
    let token = starknet::contract_address_const::<0xBB01>();
    let recipient = starknet::contract_address_const::<0xCC01>();

    // Attempt withdrawal with bogus signature
    w.withdraw_with_sig(
        0x111, // stealth_pub_x
        0x222, // stealth_pub_y
        token,
        recipient,
        1000_u256,
        1, // nonce
        0xBAD, // sig_r
        0xBAD, // sig_s
    );
}
