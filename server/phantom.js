//-------------------------------------------------------------------------------------//
// CONFIGURATION
//-------------------------------------------------------------------------------------//

var settings = {
    browserName: 'chrome',
    "phantomjs.page.settings.userAgent": 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.26 Safari/537.36'
};

//-------------------------------------------------------------------------------------//
// LIBRARIES AND VARIABLES
//-------------------------------------------------------------------------------------//

var wd = Meteor.require('wd');
var Fiber = Npm.require('fibers');
var Asserter = wd.Asserter;
var searcherBrowser = wd.remote('localhost', 9134);
var viewerBrowsers = [];
var fs = Npm.require('fs');
var crawling = false;
var items = [];
var status = "";

//-------------------------------------------------------------------------------------//
// HELPERS
//-------------------------------------------------------------------------------------//

/**
 * Always true asserter
 */
var asserter = new Asserter(
    function(target, cb) {
        cb(null, true, target);
    }
);

/**
 * Get a new session on LinkedIn
 */
function newSession(browser, callback) {
    browser.get("http://www.linkedin.com/", function() {
        browser.deleteAllCookies(function () {
            browser.refresh(function() {
                callback();
            });
        });
    });
}

/**
 * Fill in an input
 */
function input(browser, selector, terms, callback) {
    browser.elementByCssSelector(selector, function (err, el) {
        browser.type(el, terms, callback);
    });
}

/**
 * Submit a form
 */
function submit(browser, selector, callback) {
    browser.elementByCssSelector(selector, function (err, el) {
        el.submit(callback);
    });
}

/**
 * Wait for an element
 */
function waitFor(browser, selector, callback) {
    browser.waitForElementByCssSelector(selector, asserter, 10000, 200, function (err, satis, el) {
        callback(err);
    });
}

/**
 * Notice some message
 */
function notice(msg) {
    status = msg;
    console.log(msg);
}

//-------------------------------------------------------------------------------------//
// FUNCTIONS INJECTED IN PHANTOM.JS WEBPAGE
//-------------------------------------------------------------------------------------//

/**
 * Extract search results from webpage
 */
function getSearchResults() {
    var result = {ids: [], next: false},
        search = $("#results.search-results");

    $("li.result.people", search).each(function () {
        result.ids.push($(this).data("li-entity-id"));
    });

    result.next = $("#results-pagination li.next a").attr("href");
    return result;
}

/**
 * Get a User profile
 */
function async_getUserResult(callback) {
    var result = {},
        $card = $("#top-card");

    if ($card.length) {
        result.name = $("span.full-name", $card).text();
        result.locality = $("#location .locality", $card).text();
        callback(result);
    } else {
        callback(false);
    }
}

//-------------------------------------------------------------------------------------//
// BUSINESS
//-------------------------------------------------------------------------------------//

/**
 * Signin to LinkedIn and perform crawl.
 */
function go(emails, passwords, callback) {
    notice("Connecting...");

    // TODO populate viewer browsers. Fail on can't login.

    searcherBrowser.init(settings, function() {
        newSession(searcherBrowser, function () {
            input(searcherBrowser, "#session_key-login", emails[0], function () {
                input(searcherBrowser, "#session_password-login", passwords[0], function () {
                    submit(searcherBrowser, "#login", function () {
                        waitFor(searcherBrowser, ".nav-item.account-settings-tab", function(err) {
                            if (err) {
                                notice("Login failed. Search cancelled.");
                                callback();
                                return;
                            } else {
                                search(searcherBrowser, viewerBrowsers, 0, callback);
                            }
                        });
                    });
                });
            });
        });
    });
}

/**
 * Submit a new search.
 */
function search(searcherBrowser, viewerBrowsers, index, callback) {
    if (index >= items.length) {
        notice("Crawl completed.");
        callback();
        return;
    }

    item = items[index];
    notice("Searching for \"" + item.join(" ") + "\"...");

    searcherBrowser.get("http://linkedin.com/vsearch/p?keywords=" + item.join("+"), function() {
        waitFor(searcherBrowser, "#results.search-results", function () {
            getAllSearchResults(searcherBrowser, function (ids) {
                crawl(searcherBrowser, viewerBrowsers, ids, function () {
                    search(seracherBrowser, viewerBrowsers, index+1, callback);
                });
            });
        });
    });
}

/**
 * Perform seach and save all results in the database.
 */
function getAllSearchResults(browser, callback, _result) {
    _result = _result || [];

    if (!crawling) {
        notice("Aborted.");
        return;
    }

    browser.execute(getSearchResults, function (err, result) {
        if (result && result.ids && result.ids.length) {
            _result.push.apply(_result, result.ids);
        }
        if (result && result.next) {
            notice("Getting search results for page " + result.next.split("page_num=")[1] + "...");
            browser.get("http://www.linkedin.com" + result.next, function() {
                getAllSearchResults(browser, callback, _result);
            });
        } else {
            notice("Search ends with " + _result.length + " result(s).");
            callback(_result);
        }
    });
}

/**
 * Crawl the users
 */
function crawl(searcherBrowser, viewerBrowsers, ids, callback) {
    Fiber(function () {
        var id;
        var found = false;

        // Look for next id unknown.
        while (crawling && (id = ids.shift())) {
            if (!users.find({id: id}).count()) {
                console.log("New user. ID:" + id);
                found = true;
                break;
            }

            console.log("User already found. ID:" + id);
        }

        // If we've stopped crawling or we've finished with the list.
        if (!crawling) {
            notice("Aborted.");
            return;
        }
        if (!found) {
            callback();
            return;
        }

        // TODO crawl all browsers. Async?

        // Crawl this user.
        crawlUser(searcherBrowser, id, function () {
            crawl(searcherBrowser, viewerBrowsers, ids, callback);
        });
    }).run();
}

/**
 * Get User data from LinkedIn (i.e. crawl this user).
 */
function crawlUser(browser, id, callback) {
    browser.get("http://www.linkedin.com/profile/view?id=" + id, function() {
        browser.executeAsync(async_getUserResult, function (err, result) {
            Fiber(function () {
                if (!err && result) {
                    notice("Saving " + result.name + "...");
                    result.id = id;
                    result.date = (new Date).getTime();
                    users.insert(result);
                } else {
                    console.log("Failed to view profile. ID:" + id);
                }

                callback();
            }).run();
        });
    });
}

//-------------------------------------------------------------------------------------//
// PUBLISH METHODS TO THE CLIENT
//-------------------------------------------------------------------------------------//

function removeNullOrEmptyEntries(arr) {
    return arr.filter(function(n) {
        return n != undefined && n.length > 0
    });
}

Meteor.methods({
    crawl: function (value, emails, passwords, terms, locations) {
        this.unblock();

        console.log("Emails: " + emails);
        console.log("Passwords: " + passwords);
        console.log("Terms: " + terms);
        console.log("Locations: " + locations);

        crawling = value;
        items = [];
        terms = (terms || "").split(',');
        locations = locations.split(',');

        terms.forEach(function(term) {
            term = term.split(" ");

            locations.forEach(function(loc) {
                loc = loc.split(" ");
                items.push(removeNullOrEmptyEntries(term.concat(loc)));
            });
        });

        console.log(items);
        if (crawling) {
            go(emails, passwords, function() {
                crawling = false;
            });
        }
    },
    status: function () {
        return status;
    },
    crawling: function() {
        return crawling;
    }
});
