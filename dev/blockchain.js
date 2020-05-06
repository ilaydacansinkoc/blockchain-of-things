const sha256 = require('sha256');
const uuid = require('uuid/v1');
const currentNodeUrl = process.argv[3];
let merkleRoot = "";

function Blockchain() {
	this.chain = [];
	this.pendingTransactions = [];
	this.currentNodeUrl = currentNodeUrl;
	this.networkNodes = [];
	this.createNewBlock(100, '0', '0'); //genesis block
}


Blockchain.prototype.createNewBlock = function (nonce, previousBlockHash, hash) {
	const newBlock = {
		index: this.chain.length + 1,
		timestamp: Date.now(),
		transactions: this.pendingTransactions,
		nonce: nonce,
		hash: hash,
		merkleRoot: merkleRoot,
		previousBlockHash: previousBlockHash
	};

	this.pendingTransactions = [];
	this.chain.push(newBlock);

	return newBlock;
}

Blockchain.prototype.getLastBlock = function () {
	return this.chain[this.chain.length - 1];
}

//received time may be added.
Blockchain.prototype.createNewTransaction = function (temperature, humidity, sender, recipient, timestamp) {

	const newTransaction = {
		temperature: temperature,
		humidity: humidity,
		sender: sender,
		recipient: recipient,
		transactionId: uuid().split('-').join(''),
		timestamp: timestamp

	};

	return newTransaction;
}

//merkle tree needs to be implemented
//merkle hash may be constructed with amount, sender and recipient values.
Blockchain.prototype.addTransactionToPendingTransactions = function (transactionObj) {
	this.pendingTransactions.push(transactionObj);

	const txList = [];
	this.pendingTransactions.forEach(transactionData => {
		console.log(transactionData);
		txList.push(this.hashTransaction(transactionData.temperature, transactionData.humidity, transactionData.sender, transactionData.recipient));
	});

	merkleRoot = this.merkle(txList);
	console.log("merkle root: " + this.merkle(txList));

	return this.getLastBlock()['index'] + 1;
}

Blockchain.prototype.merkle = function (txList) {
	if (txList.length == 1)
		return txList[0];
	const newTxHashList = [];
	for (i = 0; i < txList.length - 1; i += 2)
		newTxHashList.push(this.hash2(txList[i], txList[i + 1]));
	if (txList.length % 2 == 1)
		newTxHashList.push(this.hash2(txList[txList.length - 1], txList[txList.length - 1]));
	return this.merkle(newTxHashList);

}

Blockchain.prototype.hash2 = function (h1, h2) {
	const dataAsString = h1.toString() + h2.toString() + "";
	const hash = sha256(dataAsString);
	return hash.toString();
}

Blockchain.prototype.hashTransaction = function (temperature, humidity, sender, recipient) {
	const dataAsString = temperature.toString() + humidity.toString() + sender.toString() + recipient.toString();
	const txHash = sha256(dataAsString);
	console.log("Temperature: " + temperature + " Humidity: " + humidity + " Sender: " + sender + " Recipient: " + recipient);
	console.log("Hash is:" + txHash);
	return txHash;
}

Blockchain.prototype.hashBlock = function (previousBlockHash, currentBlockData, nonce) {
	const dataAsString = previousBlockHash + nonce.toString() + JSON.stringify(currentBlockData);
	const hash = sha256(dataAsString);
	return hash;
}

Blockchain.prototype.proofOfWork = function (previousBlockHash, currentBlockData) {
	let nonce = 0;
	let hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
	while (hash.substring(0, 4) !== "0000") {
		nonce++;
		hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
	}
	return nonce;
}


Blockchain.prototype.chainIsValid = function (blockchain) {
	let validChain = true;
	for (var i = 1; i < blockchain.length; i++) {
		const currentBlock = blockchain[i];
		const previousBlock = blockchain[i - 1];
		const currentBlockData = {
			transactions: currentBlock['transactions'],
			index: currentBlock['index']
		};

		const blockHash = this.hashBlock(previousBlock['hash'], currentBlockData, currentBlock['nonce']);

		console.log(blockHash);

		//Check the data inside the block
		if (blockHash.substring(0, 4) !== "0000") {
			validChain = false;
		}
		console.log("Previous Block Hash ---> " + previousBlock['hash']);
		console.log("Current Previous Block Hash ---> " + currentBlock['previousBlockHash']);

		//Check chain is not valid 
		if (currentBlock['previousBlockHash'] !== previousBlock['hash']) {
			validChain = false;
		}
	}

	// Check genesis block
	const genesisBlock = blockchain[0];
	const correctNonce = genesisBlock['nonce'] === 100;
	const correctPreviousBlockHash = genesisBlock['previousBlockHash'] === '0';
	const correctHash = genesisBlock['hash'] === '0';
	const correctTransactions = genesisBlock['transactions'].length === 0;

	if (!correctNonce || !correctPreviousBlockHash || !correctHash || !correctTransactions) {
		validChain = false;
	}

	return validChain;
}

Blockchain.prototype.getBlock = function (blockHash) {
	let correctBlock = null;
	this.chain.forEach(block => {
		if (block.hash === blockHash)
			correctBlock = block;
	})
	return correctBlock;
}

Blockchain.prototype.getBlockByIndex = function (blockIndex) {
	let correctBlock = null;
	this.chain.forEach(block => {
		console.log(block.index);
		if (block.index == blockIndex)
			correctBlock = block;
	})
	return correctBlock;
}

Blockchain.prototype.getTransaction = function (transactionId) {
	let correctTransaction = null;
	let correctBlock = null;

	this.chain.forEach(block => {
		block.transactions.forEach(transaction => {
			if (transaction.transactionId === transactionId) {
				correctTransaction = transaction;
				correctBlock = block;
			}
		});
	});
	return { transaction: correctTransaction, block: correctBlock };
}

Blockchain.prototype.getAddressData = function (address) {
	const addressTransactions = [];
	this.chain.forEach(block => {
		block.transactions.forEach(transaction => {
			if (transaction.sender === address || transaction.recipient === address) {
				addressTransactions.push(transaction);
			}
		})
	})

	return { addressTransactions: addressTransactions };
}

Blockchain.prototype.getTemperatureData = function (temperature) {
	const temperatureTransactions = [];
	this.chain.forEach(block => {
		block.transactions.forEach(transaction => {
			console.log(transaction.temperature);
			if (transaction.temperature == temperature || transaction.temperature < temperature) {
				temperatureTransactions.push(transaction);
			}
		})
	})
	console.log(temperatureTransactions);
	return { temperatureTransactions: temperatureTransactions };
}

Blockchain.prototype.getHumidityData = function (humidity) {
	const humidityTransactions = [];
	this.chain.forEach(block => {
		block.transactions.forEach(transaction => {
			if (transaction.humidity == humidity || transaction.humidity > humidity) {
				humidityTransactions.push(transaction);
			}
		})
	})
	return { humidityTransactions: humidityTransactions };
}


















module.exports = Blockchain;