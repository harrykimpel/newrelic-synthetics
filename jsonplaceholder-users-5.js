/**
 * Feel free to explore, or check out the full documentation
 * https://docs.newrelic.com/docs/synthetics/new-relic-synthetics/scripting-monitors/writing-api-tests
 * for details.
 */

//monitorType: SCRIPT_API

var assert = require('assert');

$http.get('http://jsonplaceholder.typicode.com/users/5',
  // Callback
  function (err, response, body) {
    assert.equal(response.statusCode, 200, 'Expected a 200 OK response');

    console.log('Response:', body);
    assert.equal(body.id, '5', 'Expected user 5');
  }
);
