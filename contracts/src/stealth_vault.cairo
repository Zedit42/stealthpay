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
    fn withdraw_split(
        ref self: TContractState,
        stealth_pub_x: felt252,
        stealth_pub_y: felt252,
        token: ContractAddress,
        recipient_1: ContractAddress,
        amount_1: u256,
        recipient_2: ContractAddress,
        amount_2: u256,
        recipient_3: ContractAddress,
        amount_3: u256,
        num_recipients: u8,
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
        pay_stealth_pub_x: Map<u64, felt252>,
        pay_stealth_pub_y: Map<u64, felt252>,
        pay_ephemeral_pub_x: Map<u64, felt252>,
        pay_ephemeral_pub_y: Map<u64, felt252>,
        pay_token: Map<u64, ContractAddress>,
        pay_amount: Map<u64, u256>,
        payment_count: u64,
        balances: Map<(felt252, ContractAddress), u256>,
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

    fn verify_sig(stealth_pub_x: felt252, msg_hash: felt252, sig_r: felt252, sig_s: felt252) {
        let is_valid = core::ecdsa::check_ecdsa_signature(msg_hash, stealth_pub_x, sig_r, sig_s);
        assert!(is_valid, "Invalid signature");
    }

    #[abi(embed_v0)]
    impl StealthVaultImpl of super::IStealthVault<ContractState> {
        fn send_to_stealth(
            ref self: ContractState,
            stealth_pub_x: felt252, stealth_pub_y: felt252,
            ephemeral_pub_x: felt252, ephemeral_pub_y: felt252,
            token: ContractAddress, amount: u256,
        ) {
            assert!(amount > 0, "Amount must be > 0");
            assert!(ephemeral_pub_x != 0, "Invalid ephemeral key");

            let caller = get_caller_address();
            let this = get_contract_address();
            let token_dispatcher = IERC20Dispatcher { contract_address: token };
            token_dispatcher.transfer_from(caller, this, amount);

            let current = self.balances.read((stealth_pub_x, token));
            self.balances.write((stealth_pub_x, token), current + amount);

            let index = self.payment_count.read();
            self.pay_stealth_pub_x.write(index, stealth_pub_x);
            self.pay_stealth_pub_y.write(index, stealth_pub_y);
            self.pay_ephemeral_pub_x.write(index, ephemeral_pub_x);
            self.pay_ephemeral_pub_y.write(index, ephemeral_pub_y);
            self.pay_token.write(index, token);
            self.pay_amount.write(index, amount);
            self.payment_count.write(index + 1);

            self.emit(StealthPayment {
                stealth_pub_x, stealth_pub_y, ephemeral_pub_x, ephemeral_pub_y, token, amount, index,
            });
        }

        fn withdraw(
            ref self: ContractState,
            stealth_pub_x: felt252, stealth_pub_y: felt252,
            token: ContractAddress, recipient: ContractAddress,
            amount: u256, nonce: felt252, sig_r: felt252, sig_s: felt252,
        ) {
            assert!(!self.used_nonces.read(nonce), "Nonce already used");

            let balance = self.balances.read((stealth_pub_x, token));
            assert!(balance >= amount, "Insufficient balance");

            let token_felt: felt252 = token.into();
            let recipient_felt: felt252 = recipient.into();
            let msg_hash = PoseidonTrait::new()
                .update(stealth_pub_x).update(stealth_pub_y)
                .update(token_felt).update(recipient_felt)
                .update(amount.low.into()).update(amount.high.into())
                .update(nonce)
                .finalize();

            verify_sig(stealth_pub_x, msg_hash, sig_r, sig_s);

            self.used_nonces.write(nonce, true);
            self.balances.write((stealth_pub_x, token), balance - amount);

            let token_dispatcher = IERC20Dispatcher { contract_address: token };
            token_dispatcher.transfer(recipient, amount);

            self.emit(StealthWithdrawal { stealth_pub_x, recipient, token, amount });
        }

        fn withdraw_split(
            ref self: ContractState,
            stealth_pub_x: felt252, stealth_pub_y: felt252,
            token: ContractAddress,
            recipient_1: ContractAddress, amount_1: u256,
            recipient_2: ContractAddress, amount_2: u256,
            recipient_3: ContractAddress, amount_3: u256,
            num_recipients: u8,
            nonce: felt252, sig_r: felt252, sig_s: felt252,
        ) {
            assert!(!self.used_nonces.read(nonce), "Nonce already used");
            assert!(num_recipients >= 1 && num_recipients <= 3, "1-3 recipients");

            let total = if num_recipients == 1 {
                amount_1
            } else if num_recipients == 2 {
                amount_1 + amount_2
            } else {
                amount_1 + amount_2 + amount_3
            };

            let balance = self.balances.read((stealth_pub_x, token));
            assert!(balance >= total, "Insufficient balance");

            let token_felt: felt252 = token.into();
            let r1_felt: felt252 = recipient_1.into();
            let r2_felt: felt252 = recipient_2.into();
            let r3_felt: felt252 = recipient_3.into();
            let msg_hash = PoseidonTrait::new()
                .update(stealth_pub_x).update(stealth_pub_y)
                .update(token_felt)
                .update(r1_felt).update(amount_1.low.into()).update(amount_1.high.into())
                .update(r2_felt).update(amount_2.low.into()).update(amount_2.high.into())
                .update(r3_felt).update(amount_3.low.into()).update(amount_3.high.into())
                .update(num_recipients.into())
                .update(nonce)
                .finalize();

            verify_sig(stealth_pub_x, msg_hash, sig_r, sig_s);

            self.used_nonces.write(nonce, true);
            self.balances.write((stealth_pub_x, token), balance - total);

            let token_dispatcher = IERC20Dispatcher { contract_address: token };

            token_dispatcher.transfer(recipient_1, amount_1);
            self.emit(StealthWithdrawal { stealth_pub_x, recipient: recipient_1, token, amount: amount_1 });

            if num_recipients >= 2 {
                token_dispatcher.transfer(recipient_2, amount_2);
                self.emit(StealthWithdrawal { stealth_pub_x, recipient: recipient_2, token, amount: amount_2 });
            }

            if num_recipients >= 3 {
                token_dispatcher.transfer(recipient_3, amount_3);
                self.emit(StealthWithdrawal { stealth_pub_x, recipient: recipient_3, token, amount: amount_3 });
            }
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
