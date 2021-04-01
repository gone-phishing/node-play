'use strict';
/*
 'use strict' is not required but helpful for turning syntactical errors into true errors in the program flow
 https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode
*/

/*
 Modules make it possible to import JavaScript files into your application.  Modules are imported
 using 'require' statements that give you a reference to the module.

  It is a good idea to list the modules that your application depends on in the package.json in the project root
 */
let util = require('util');
const promise = require('bluebird');
const _ = require('lodash');
const options = {
  promiseLib: promise
};

const pgp = require('pg-promise')(options);
const connectionString = 'postgres://localhost:5432/transactions';
const db = pgp(connectionString);

const addTxn = (req, res) => {
  console.log("Going to add txn for:: " + JSON.stringify(req.body));
  const txn_id = req.swagger.params.transaction_id.value;
  const parent_id = req.body.parent_id;
  const amount = req.body.amount;
  const type = req.body.type;
  db.none('insert into transactions(txn_id, parent_id, amount, type)' +
      'values(${txn_id}, ${parent_id}, ${amount}, ${type})',
    txn_id, parent_id, amount, type)
    .then(function () {
      res.status(200)
        .json({
          status: 'OK',
        });
    })
    .catch(function (err) {
      res.status(400).json({
        message: 'Error in finding txn with:: ' + JSON.stringify(err)
      });
    });
}

const getTxn = (req, res) => {
  const txn_id = req.swagger.params.transaction_id.value;
  console.log("Getting list of all txn:: " + txn_id);
  db.one('select * from transactions where txn_id = $1', txn_id)
    .then(function (data) {
      res.status(200)
        .json({
          amount: data.amount,
          type: data.type,
          parent_id: data.parent_id
        });
    })
    .catch(function (err) {
      res.status(400).json({
        message: 'Error in finding txn with:: ' + JSON.stringify(err)
      });
    });
}

const getTxnByType = (req, res) => {
  const type = req.swagger.params.type.value
  console.log("Filtering txn by type:: " + type);
  db.any('select * from transactions where type = $1', type)
    .then(function (data) {
      const idList = _.map(data, 'txn_id');
      res.status(200)
        .json({
          txn_list: _.join(idList, ',')
        });
    })
    .catch(function (err) {
      res.status(400).json({
        message: 'Error in finding txn with:: ' + JSON.stringify(err)
      });
    });
}

/**
 * 
 * @param {*} req 
 * @param {*} res 
 * A really bad approach to this will be keep doing recursive SQL calls from nodejs to DB.
 * But that will not scale well as soon as you have over 1M records in DB. 
 * Direct SQL seems like a better option.
 * 
 * Okay so, I couldn't come up with the SQL for this on my own. I have used SQL joins, or cases in the past
 * but never a recursive stmt directly into SQL. Thanks to this answer on stackoverflow:
 * https://stackoverflow.com/questions/61816962/how-to-query-sum-total-of-transitively-linked-child-transactions-from-database
 * Seems like someone asked the exact same thing. Also the accepted solution works as tested here:
 * http://sqlfiddle.com/#!17/ccf00/4
 * Then again, if I get through this round, I will probably revise this part a bit before the next round. If not,
 * then yeah I did what's the most dev thing to do. Copied from stack overflow to save on time \/
 */
const getTxnSum = (req, res) => {
  console.log("Finding sum for:: " + req.swagger.params.transaction_id.value);

  db.one('with recursive cte as ( \
select txn_id as ultimate_id, txn_id, amount from transactions where txn_id = $1 \
    union all \
    select cte.ultimate_id, transactions.txn_id, transactions.amount \
    from cte join transactions on transactions.parent_id = cte.txn_id ) \
select ultimate_id, sum(amount) \
from cte group by ultimate_id;', txn_id)
    .then(function (data) {
      res.status(200)
        .json({
          sum: data.sum
        });
    })
    .catch(function (err) {
      res.status(400).json({
        message: 'Error in finding sum with:: ' + JSON.stringify(err)
      });
    });
}

module.exports = {
  addTxn,
  getTxn,
  getTxnByType,
  getTxnSum
};
