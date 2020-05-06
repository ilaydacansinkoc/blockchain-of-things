const Blockchain = require('./blockchain');
const bitcoin = new Blockchain();

const bc1 = {
    "chain": [
        {
            "index": 1,
            "timestamp": 1556020986868,
            "transactions": [],
            "nonce": 100,
            "hash": "0",
            "merkleRoot": "",
            "previousBlockHash": "0"
        },
        {
            "index": 2,
            "timestamp": 1556021003290,
            "transactions": [
                {
                    "temperature": 25,
                    "humidity": 61,
                    "sender": "ZAABSDA85D97",
                    "recipient": "SFKDWRJ8722ADA"
                },
                {
                    "temperature": 25,
                    "humidity": 61,
                    "sender": "ZAABSDA85D97",
                    "recipient": "SFKDWRJ8722ADA"
                },
                {
                    "temperature": 25,
                    "humidity": 61,
                    "sender": "ZAABSDA85D97",
                    "recipient": "SFKDWRJ8722ADA"
                }
            ],
            "nonce": 24698,
            "hash": "00002326dd19f5a0e8c7a78667b7e6b6b2a00dd2621aee54773dafa4c54b5f64",
            "merkleRoot": "9e84e57df50cd9d9adfbe61304504869c0df0ba0fd87ae17a01565235fadcec6",
            "previousBlockHash": "0"
        }
    ],
    "pendingTransactions": [
        {
            "temperature": 12.5,
            "humidity": 12.5,
            "sender": "00",
            "recipient": "c15bab4065bf11e9927d15e7fb126e7c"
        }
    ],
    "currentNodeUrl": "http://localhost:3001",
    "networkNodes": []
};

console.log("VALID: " + bitcoin.chainIsValid(bc1.chain));