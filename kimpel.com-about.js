/**
 * Feel free to explore, or check out the full documentation
 * https://docs.newrelic.com/docs/synthetics/new-relic-synthetics/scripting-monitors/writing-scripted-browsers
 * for details.
 */

var assert = require('assert');
monitorType: SCRIPT_BROWSER
$browser.get('https://www.kimpel.com/about').then(function(){
  // Check the H1 title matches "Example Domain"
  return $browser.findElement($driver.By.css('h1')).then(function(element){
    return element.getText().then(function(text){
     //assert.equal('Example Domain', text, 'Page H1 title did not match');
    });
  });
}).then(function(){
  // Check that the external link matches "https://www.iana.org/domains/example"
  return $browser.findElement($driver.By.xpath('/html/body/header/div/nav/div/a')).then(function(element){
    return element.getAttribute('href').then(function(link){
      assert.equal('https://www.kimpel.com/', link, 'home page link did not work');
    });
  });
});
