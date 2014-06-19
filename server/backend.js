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
var fs = Npm.require('fs');
var Fiber = Npm.require('fibers');
var Asserter = wd.Asserter;
var viewerBrowsers = [];
var fs = Npm.require('fs');
var crawling = false;
var items = [];
var status = "";

// Populated downstairs.
var viewerIPs;
var searcherBrowser;

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
function go(searcherBrowser, viewerBrowsers, emails, passwords, callback) {
    viewerBrowsers = [];

    initViewerBrowsers(viewerBrowsers, emails, passwords, 0,
        function() {
            // Success callback.
            searcherBrowser.init(settings, function() {
                login(searcherBrowser, emails[0], passwords[0],
                    function() {
                        search(searcherBrowser, viewerBrowsers, 0, callback);
                },
                    function() {
                        return;
                });
            });
        }, function () {
            // Failure callback.
            callback();
        });
}

function initViewerBrowsers(viewerBrowsers, emails, passwords, index, callback_success, callback_failure) {
    if (index+1 == emails.length) {
        callback_success();
        return;
    }

    email = emails[index+1];
    password = passwords[index+1];

    if (email.length == 0 || password.length == 0) {
        return;
    }

    b = wd.remote(viewerIPs[index+1], 9135);
    b.init(settings, function() {
        login(b, email, password,
            function() {
                viewerBrowsers.push(b);
                initViewerBrowsers(viewerBrowsers, emails, passwords, index+1, callback_success, callback_failure);
            },
            function() {
                notice("Can't login; bad credential for " + email);
                callback_failure();
            });
    });
}

/**
 * Login using the given credentials.
 */
function login(browser, email, password, callback_success, callback_failure) {
    notice("Logging in as " + email + "...");

    newSession(browser, function () {
        input(browser, "#session_key-login", email, function () {
            input(browser, "#session_password-login", password, function () {
                submit(browser, "#login", function () {
                    waitFor(browser, ".nav-item.account-settings-tab", function(err) {
                        if (err) {
                            callback_failure();
                        } else {
                            callback_success();
                        }
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
            getAllSearchResults(searcherBrowser, "[" + item.join(" ") + "]", function (ids) {
                crawl(searcherBrowser, viewerBrowsers, ids, ids.length, "[" + item.join(" ") + "]", function () {
                    search(searcherBrowser, viewerBrowsers, index+1, callback);
                });
            });
        });
    });
}

/**
 * Perform seach and save all results in the database.
 */
function getAllSearchResults(browser, logPrefix, callback, _result) {
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
            notice(logPrefix + " getting search results for page " + result.next.split("page_num=")[1] + "...");
            browser.get("http://www.linkedin.com" + result.next, function() {
                getAllSearchResults(browser, logPrefix, callback, _result);
            });
        } else {
            notice(logPrefix + " search ends with " + _result.length + " result(s).");
            callback(_result);
        }
    });
}

/**
 * Crawl the users
 */
function crawl(searcherBrowser, viewerBrowsers, ids, total, logPrefix, callback) {
    Fiber(function () {
        var id;
        var found = false;

        // Look for next id unknown.
        while (crawling && (id = ids.shift())) {
            if (!users.find({id: id}).count()) {
                console.log("New user: " + id);
                found = true;
                break;
            } else {
                console.log("Duplicate user: " + id);
            }
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

        // Crawl this user.
        crawlUserWithBrowser(searcherBrowser, id, function (err, result) {
            Fiber(function () {
                if (!err && result) {
                    notice(logPrefix + " [" + (total-ids.length+1) + "/" + total + "] saving " + result.name + "...");
                    result.id = id;
                    result.date = (new Date).getTime();
                    users.insert(result);
                }

                crawlUserWithBrowsers(viewerBrowsers, id, function() {
                    crawl(searcherBrowser, viewerBrowsers, ids, total, logPrefix, callback);
                });
            }).run();
        });
    }).run();
}

/**
 * Crawl this user's profile using the given browsers. Ignores errors.
 */
function crawlUserWithBrowsers(browsers, id, callback, _index) {
    _index = _index || 0;

    if (_index >= browsers.length) {
        callback();
        return;
    }

    b = browsers[_index];
    console.log("View with browser index " + _index);

    crawlUserWithBrowser(b, id, function(err, result) {
        // Ignore errors.
        crawlUserWithBrowsers(browsers, id, callback, _index+1);
    });
}

/**
 * Crawl this user's profile with the given browser.
 */
function crawlUserWithBrowser(browser, id, callback) {
    browser.get("http://www.linkedin.com/profile/view?id=" + id, function() {
        browser.executeAsync(async_getUserResult, function (err, result) {
            callback(err, result);
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
            // FIXME remove docker IP reference once phantomjs bug if fixed.
            fs.readFile('../../../../../.docker-ips', function read(err, data) {
                if (err) {
                    throw err;
                }
                viewerIPs = data.toString().split('\n');
                searcherBrowser = wd.remote(viewerIPs[0], 9135);

                go(searcherBrowser, viewerBrowsers, emails, passwords, function() {
                    crawling = false;
                });
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
