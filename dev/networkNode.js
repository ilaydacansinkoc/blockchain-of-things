const express = require('express')
const app = express()
const bodyParser = require('body-parser');
const Blockchain = require('./blockchain');
var lineReader = require('line-reader');
const uuid = require('uuid/v1');
const port = process.argv[2];
const fs = require('fs')
const rp = require('request-promise');

const bitcoin = new Blockchain();
const nodeAddress = uuid().split('-').join("");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/chain', function (req, res) {
	res.send(bitcoin);
});

app.get('/blockchain', function (req, res) {
	res.sendFile('./blockchain/blockchain.html', { root: __dirname });
});

//create new transaction
app.post('/transaction', function (req, res) {
	const newTransaction = req.body;
	const blockIndex = bitcoin.addTransactionToPendingTransactions(newTransaction);
	res.json({
		note: `Transaction will be added in block ${blockIndex}.`
	})
});

app.post('/transaction/broadcast', function (req, res) {
	//create new transaction and broad it to the network.
	//addTransactionToPendingTransactions
	const newTransaction = bitcoin.createNewTransaction(req.body.temperature, req.body.humidity, req.body.sender, req.body.recipient, req.body.timestamp);
	bitcoin.addTransactionToPendingTransactions(newTransaction);

	const requestPromises = [];

	bitcoin.networkNodes.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: networkNodeUrl + '/transaction',
			method: 'POST',
			body: newTransaction,
			json: true
		};
		requestPromises.push(rp(requestOptions));
	});

	//Run all of these requests
	Promise.all(requestPromises).then(data => {
		res.json({
			note: 'Transaction created and broadcasted succesfully.'
		});
	});

});

//create new block
app.get('/mine', function (req, res) {
	const lastBlock = bitcoin.getLastBlock();
	const previousBlockHash = lastBlock['hash'];

	const currentBlockData = {
		transactions: bitcoin.pendingTransactions,
		index: lastBlock['index'] + 1
	};

	const nonce = bitcoin.proofOfWork(previousBlockHash, currentBlockData);
	const blockHash = bitcoin.hashBlock(previousBlockHash, currentBlockData, nonce);
	const newBlock = bitcoin.createNewBlock(nonce, previousBlockHash, blockHash);

	const requestPromises = [];
	bitcoin.networkNodes.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: networkNodeUrl + '/receive-new-block',
			method: 'POST',
			body: { newBlock: newBlock },
			json: true
		};
		requestPromises.push(rp(requestOptions));
	});

	//Run all requests -- Check for mining reward
	Promise.all(requestPromises).then(data => {
		const requestOptions = {
			uri: bitcoin.currentNodeUrl + '/transaction/broadcast',
			method: 'POST',
			body: { temperature: 10, humidity: 10, sender: "00", recipient: nodeAddress },
			json: true
		};
		return rp(requestOptions);
	}).then(data => {
		res.json({
			note: "New block mined and broadcasted successfully.",
			block: newBlock
		});
	});
});

app.post('/receive-new-block', function (req, res) {
	const newBlock = req.body.newBlock;
	const lastBlock = bitcoin.getLastBlock();
	const correctHash = lastBlock.hash === newBlock.previousBlockHash;
	const correctIndex = lastBlock['index'] + 1 === newBlock['index'];

	//Legitimate block
	if (correctHash && correctIndex) {
		bitcoin.chain.push(newBlock);
		bitcoin.pendingTransactions = [];
		res.json({
			note: 'New block received and accepted.',
			newBlock: newBlock
		})
	} else {
		res.json({
			note: 'New block rejected.',
			newBlock: newBlock
		})
	}
})

//implementing longest chain rule
app.get('/consensus', function (req, res) {
	const requestPromises = [];
	bitcoin.networkNodes.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: networkNodeUrl + '/chain',
			method: 'GET',
			json: true
		};

		requestPromises.push(rp(requestOptions));
	});

	Promise.all(requestPromises)
		.then(blockchains => {
			const currentChainLength = bitcoin.chain.length;
			let maxChainLength = currentChainLength;
			let newLongestChain = null;
			let newPendingTransactions = null;

			blockchains.forEach(blockchain => {
				if (blockchain.chain.length > maxChainLength) {
					maxChainLength = blockchain.chain.length;
					newLongestChain = blockchain.chain;
					newPendingTransactions = blockchain.pendingTransactions;
				};
			});


			if (!newLongestChain || (newLongestChain && !bitcoin.chainIsValid(newLongestChain))) {
				res.json({
					note: 'Current chain has not been replaced.',
					chain: bitcoin.chain
				});
			}
			else {
				bitcoin.chain = newLongestChain;
				bitcoin.pendingTransactions = newPendingTransactions;
				res.json({
					note: 'This chain has been replaced.',
					chain: bitcoin.chain
				});
			}
		});
});

//register a node and broadcast it to the network
app.post('/register-and-broadcast-node', function (req, res) {

	const newNodeUrl = req.body.newNodeUrl;
	if (bitcoin.networkNodes.indexOf(newNodeUrl) == -1)
		bitcoin.networkNodes.push(newNodeUrl);

	// Promise used for 
	const regNodesPromises = [];

	// for each network node present in array, register new node url
	// with each of the network nodes.
	bitcoin.networkNodes.forEach(networkNodeUrl => {
		// options what we want to use for each request.
		const requestOptions = {
			//what uri that we want to hit
			uri: networkNodeUrl + '/register-node',
			method: 'POST',
			//what data(object) we want to pass along with this request  
			body: { newNodeUrl: newNodeUrl },
			//sent as json data
			json: true
		};

		regNodesPromises.push(rp(requestOptions));
	});

	//run all requests here
	Promise.all(regNodesPromises)
		.then(data => {
			const bulkRegisterOptions = {
				uri: newNodeUrl + '/register-nodes-bulk',
				method: 'POST',
				body: { allNetworkNodes: [...bitcoin.networkNodes, bitcoin.currentNodeUrl] },
				json: true
			};

			return rp(bulkRegisterOptions);
		})
		.then(data => {
			res.json({ note: "New Node Registered Successfully." });
		});
});

//register a node with the network
app.post('/register-node', function (req, res) {
	const newNodeUrl = req.body.newNodeUrl;
	const nodeNotAlreadyPresent = bitcoin.networkNodes.indexOf(newNodeUrl) == -1;
	const notCurrentNode = bitcoin.currentNodeUrl !== newNodeUrl;
	if (nodeNotAlreadyPresent && notCurrentNode)
		bitcoin.networkNodes.push(newNodeUrl);
	res.json({ note: "New Node Registered Successfully." });

});

//register multiple nodes 
app.post('/register-nodes-bulk', function (req, res) {
	const allNetworkNodes = req.body.allNetworkNodes;
	allNetworkNodes.forEach(networkNodeUrl => {
		const nodeNotAlreadyPresent = bitcoin.networkNodes.indexOf(networkNodeUrl) == -1;
		const notCurrentNode = bitcoin.currentNodeUrl !== networkNodeUrl;
		if (nodeNotAlreadyPresent && notCurrentNode)
			bitcoin.networkNodes.push(networkNodeUrl);
	});

	res.json({ note: "Bulk registration successful." });
});

//localhost:3001/block/aaysdjhaknasasaswawdas
app.get('/block/:blockHash', function (req, res) {
	const blockHash = req.params.blockHash;
	const correctBlock = bitcoin.getBlock(blockHash);
	res.json({
		block: correctBlock
	});
});

app.get('/blockByIndex/:blockIndex', function (req, res) {
	const blockIndex = req.params.blockIndex;
	const correctBlock = bitcoin.getBlockByIndex(blockIndex);
	res.json({
		block: correctBlock
	});
});



//returns correct block and transaction where the transactionId occurs
app.get('/transaction/:transactionId', function (req, res) {
	const transactionId = req.params.transactionId;
	const transactionData = bitcoin.getTransaction(transactionId);
	res.json({
		transaction: transactionData.transaction,
		block: transactionData.block
	});
});

app.get('/address/:address', function (req, res) {
	const address = req.params.address;
	const addressData = bitcoin.getAddressData(address);
	res.json({
		addressData: addressData
	})
});

app.get('/temperature/:temperature', function (req, res) {
	const temperature = req.params.temperature;
	console.log("ad->" + temperature);
	const temperatureData = bitcoin.getTemperatureData(temperature);
	res.json({
		temperatureData: temperatureData
	})
});

app.get('/humidity/:humidity', function (req, res) {
	const humidity = req.params.humidity;
	const humidityData = bitcoin.getHumidityData(humidity);
	res.json({
		humidityData: humidityData
	})
});



app.get('/mine-automatically', function (req, res) {

	const requestPromises = [];
	var keyValue = 0;
	var temperature = null;
	var humidity = null;
	var sender = null;
	var recipient = null;
	var transactionObjectList = [];

	lineReader.eachLine('data.txt', function (line, last) {
		var transactionData = line.split(',');
		keyValue++;
		if (keyValue === 1) return;
		else {
			var transactionObj = null;

			temperature = parseInt(transactionData[0]);
			humidity = parseInt(transactionData[1]);
			sender = transactionData[2];
			timestamp = transactionData[3];
			recipient = bitcoin.currentNodeUrl;

			transactionObj = {
				temperature: temperature,
				humidity: humidity,
				sender: sender,
				recipient: recipient,
				timestamp: timestamp
			};

			transactionObjectList.push(transactionObj);
		}
		if (last) {
			transactionObjectList.forEach(transactionObject => {
				console.log(transactionObject);
				bitcoin.networkNodes.forEach(networkNodeUrl => {
					const requestOptions = {
						uri: networkNodeUrl + '/transaction/broadcast',
						method: 'POST',
						body: transactionObject,
						json: true
					};
					requestPromises.push(rp(requestOptions));
				});
			});

			//Run all requests -- Check for mining reward
			Promise.all(requestPromises).then(data => {
				const requestOptions = {
					uri: bitcoin.currentNodeUrl + '/mine',
					method: 'GET',
					json: true
				};
				return rp(requestOptions);
			}).then(data => {
				res.json({
					note: "New block mined and broadcasted successfully.",
				});
			});

			//Data.txt temizle.
			/*fs.writeFile('data.txt', '', function () { });

			const sleep = (milliseconds) => {
				return new Promise(resolve => setTimeout(resolve, milliseconds))
			}

			sleep(20000).then(() => {
				const mineRequestOp = {
					uri: bitcoin.currentNodeUrl + '/mine-automatically',
					method: 'GET',
					json: true
				};

				return rp(mineRequestOp);
			});*/


		}
	});


});

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

app.get('/chain-explorer', function (req, res) {
	res.sendFile('./chain-explorer/index.html', { root: __dirname });
})

app.get('/main-page', function (req, res) {
	res.sendFile('./main-page/mainpage.html', { root: __dirname });
})

app.listen(port, function () {
	console.log(`Listening on port ${port}...`);
});
