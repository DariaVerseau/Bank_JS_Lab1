const Bank = (function () {
  // Приватное хранилище аккаунтов
  const accounts = new Map(); // accountNumber -> account

  // Вспомогательная функция для генерации уникального 10-значного номера счёта
  function generateUniqueAccountNumber() {
    let num;
    do {
      num = Math.floor(Math.random() * 9e9 + 1e9).toString(); // от 1000000000 до 9999999999
    } while (accounts.has(num));
    return num;
  }


  function hashPin(pin) {
    if (typeof pin !== 'number' || pin < 0 || pin > 9999) {
      throw new Error('PIN must be a 4-digit number');
    }
    return (pin * 123 + 456) % 10000;
  }

  function createAccount(holderName, initialBalance, pinCode) {
    if (initialBalance < 0) {
      throw new Error('Initial balance cannot be negative');
    }

    const accountNumber = generateUniqueAccountNumber();
    const hashedPin = hashPin(pinCode);

    // Приватное состояние баланса (через замыкание)
    let _balance = initialBalance;
    const transactions = [];

    // Добавляем начальную транзакцию, если баланс > 0
    if (initialBalance > 0) {
      transactions.push({
        type: 'deposit',
        amount: initialBalance,
        date: Date.now(),
      });
    }

    // Внутренний метод для изменения баланса (только для системных операций)
    function _adjustBalance(delta) {
      _balance += delta;
    }

    // Публичный интерфейс аккаунта
    const account = {
      accountNumber,
      holderName,

      deposit(amount) {
        if (amount <= 0) throw new Error('Deposit amount must be positive');
        _adjustBalance(amount);
        transactions.push({
          type: 'deposit',
          amount,
          date: Date.now(),
        });
      },

      withdraw(amount, pin) {
        if (hashPin(pin) !== hashedPin) {
          throw new Error('Invalid PIN');
        }
        if (amount <= 0) throw new Error('Withdraw amount must be positive');
        if (amount > _balance) {
          throw new Error('Insufficient funds');
        }
        _adjustBalance(-amount);
        transactions.push({
          type: 'withdraw',
          amount,
          date: Date.now(),
        });
      },

      getBalance(pin) {
        if (hashPin(pin) !== hashedPin) {
          throw new Error('Invalid PIN');
        }
        return _balance;
      },

      getTransactionHistory(pin, days = 30) {
        if (hashPin(pin) !== hashedPin) {
          throw new Error('Invalid PIN');
        }
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        return transactions
          .filter(tx => tx.date >= cutoff)
          .sort((a, b) => b.date - a.date);
      },

      // Внутренние методы, недоступные извне (но доступны через замыкание в transferFunds)
      _adjustBalance,
      _getTransactions: () => transactions,
      _getHashedPin: () => hashedPin,
    };

    // Регистрируем аккаунт
    accounts.set(accountNumber, account);
    return {
      accountNumber,
      holderName,
      deposit: account.deposit,
      withdraw: account.withdraw,
      getBalance: account.getBalance,
      getTransactionHistory: account.getTransactionHistory,
    };
  }

  // Поиск аккаунта по номеру (внутренний)
  function _findAccount(accountNumber) {
    return accounts.get(accountNumber);
  }

  // Перевод средств
  function transferFunds(fromAccount, toAccountNumber, amount, pin) {
    if (amount <= 0) throw new Error('Transfer amount must be positive');

    const toAccount = _findAccount(toAccountNumber);
    if (!toAccount) {
      throw new Error('Recipient account not found');
    }

    // Проверка PIN отправителя
    if (hashPin(pin) !== fromAccount._getHashedPin()) {
      throw new Error('Invalid PIN');
    }

  }

  // Переработанный transferFunds: принимает номера счетов
  function transfer(fromAccountNumber, toAccountNumber, amount, pin) {
    if (amount <= 0) throw new Error('Transfer amount must be positive');

    const fromAccount = _findAccount(fromAccountNumber);
    const toAccount = _findAccount(toAccountNumber);

    if (!fromAccount) throw new Error('Sender account not found');
    if (!toAccount) throw new Error('Recipient account not found');

    if (hashPin(pin) !== fromAccount._getHashedPin()) {
      throw new Error('Invalid PIN');
    }

    // Проверка баланса: добавим внутренний геттер
    const currentBalance = (function () {
      return fromAccount._getBalance();
    })();

    if (amount > currentBalance) {
      throw new Error('Insufficient funds');
    }

    // Выполняем перевод
    fromAccount._adjustBalance(-amount);
    toAccount._adjustBalance(amount);

    const now = Date.now();
    fromAccount._getTransactions().push({
      type: 'transfer-out',
      amount,
      date: now,
      to: toAccountNumber,
    });

    toAccount._getTransactions().push({
      type: 'transfer-in',
      amount,
      date: now,
      from: fromAccountNumber,
    });
  }

  function createAccountFinal(holderName, initialBalance, pinCode) {
    if (initialBalance < 0) throw new Error('Initial balance cannot be negative');
    const accountNumber = generateUniqueAccountNumber();
    const hashedPin = hashPin(pinCode);
    let _balance = initialBalance;
    const transactions = [];

    if (initialBalance > 0) {
      transactions.push({ type: 'deposit', amount: initialBalance, date: Date.now() });
    }

    const account = {
      accountNumber,
      holderName,
      _getBalance: () => _balance,
      _getHashedPin: () => hashedPin,
      _adjustBalance: (delta) => { _balance += delta; },
      _getTransactions: () => transactions,

      deposit(amount) {
        if (amount <= 0) throw new Error('Deposit amount must be positive');
        _balance += amount;
        transactions.push({ type: 'deposit', amount, date: Date.now() });
      },

      withdraw(amount, pin) {
        if (hashPin(pin) !== hashedPin) throw new Error('Invalid PIN');
        if (amount <= 0) throw new Error('Withdraw amount must be positive');
        if (amount > _balance) throw new Error('Insufficient funds');
        _balance -= amount;
        transactions.push({ type: 'withdraw', amount, date: Date.now() });
      },

      getBalance(pin) {
        if (hashPin(pin) !== hashedPin) throw new Error('Invalid PIN');
        return _balance;
      },

      getTransactionHistory(pin, days = 30) {
        if (hashPin(pin) !== hashedPin) throw new Error('Invalid PIN');
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        return transactions.filter(tx => tx.date >= cutoff).sort((a, b) => b.date - a.date);
      },
    };

    accounts.set(accountNumber, account);

    // Возвращаем только публичный интерфейс
    return {
      accountNumber,
      holderName,
      deposit: account.deposit,
      withdraw: account.withdraw,
      getBalance: account.getBalance,
      getTransactionHistory: account.getTransactionHistory,
    };
  }

  // Используем createAccountFinal
  return {
    createAccount: createAccountFinal,
    transfer,
    // Для отладки можно добавить getAccount, но в продакшене — нет
  };
})();

/*
const acc1 = Bank.createAccount("Alice", 1000, 1234);
const acc2 = Bank.createAccount("Bob", 500, 5678);

acc1.deposit(200);
acc1.withdraw(100, 1234);
console.log(acc1.getBalance(1234)); // 1100

Bank.transfer(acc1.accountNumber, acc2.accountNumber, 300, 1234);
console.log(acc1.getBalance(1234)); // 800
console.log(acc2.getBalance(5678)); // 800

console.log(acc1.getTransactionHistory(1234, 7));
*/
