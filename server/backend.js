//-------------------------------------------------------------------------------------//
// Configuration
//-------------------------------------------------------------------------------------//

var settings = {
    browserName: 'firefox'
};

//-------------------------------------------------------------------------------------//
// Libraries and variables
//-------------------------------------------------------------------------------------//

var wd = Meteor.require('wd');
var Fiber = Meteor.require('fibers');
var Asserter = wd.Asserter;
var fs = Meteor.require('fs');
var crawling = false;
var terms = [];
var status = "";
var searcherBrowser = wd.remote('localhost', 9135);
var viewerBrowsers = [];
var RateLimiter = Meteor.require('limiter').RateLimiter;
var limiter = new RateLimiter(1, 10000); // params are somewhat arbitrary; experiement.

//-------------------------------------------------------------------------------------//
// Helpers
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
 * Get a page
 */
function get(browser, page, callback) {
    limiter.removeTokens(1, function() {
        browser.get(page, callback);
    });
}

/**
 * Get a new session on LinkedIn
 */
function newSession(browser, callback) {
    get(browser, "http://www.linkedin.com/", function() {
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
    limiter.removeTokens(1, function() {
        browser.elementByCssSelector(selector, function (err, el) {
            el.submit(callback);
        });
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
// Functions injected into webpage
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
        result.headline = $("#headline .title", $card).text();
        result.locality = $("#location .locality", $card).text();
        callback(result);
    } else {
        callback(false);
    }
}

//-------------------------------------------------------------------------------------//
// Business
//-------------------------------------------------------------------------------------//

/**
 * Signin to LinkedIn and perform crawl.
 */
function go(searcherBrowser, viewerBrowsers, emails, passwords, callback) {
    search(searcherBrowser, viewerBrowsers, emails, passwords, 0, callback);
}

/**
 * Init and sign in to seacher and viewer browsers.
 */
function initBrowsers(searcherBrowser, viewerBrowsers, emails, passwords, callback_success, callback_failure) {
    initViewerBrowsers(viewerBrowsers, emails, passwords, 0,
        function() {
            // Success callback.
            searcherBrowser.init(settings, function() {
                login(searcherBrowser, emails[0], passwords[0], function() {
                    // Success callback.
                    callback_success();
                }, function() {
                    // Failure callback.
                    callback_failure();
                });
            });
        }, function () {
            // Failure callback.
            callback_failure();
        });
}

/**
 * Init and sign in to viewer browsers.
 */
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

    var b;
    if (index < viewerBrowsers.length) {
        b = viewerBrowsers[index];
    } else {
        b = wd.remote('localhost', 9136 + index);
        viewerBrowsers.push(b);
    }

    b.init(settings, function() {
        login(b, email, password,
            function() {
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
function search(searcherBrowser, viewerBrowsers, emails, passwords, index, callback) {
    if (index >= terms.length) {
        notice("Crawl completed.");
        callback();
        return;
    }

    term = terms[index];
    initBrowsers(searcherBrowser, viewerBrowsers, emails, passwords, function() {
        // Success callback.
        notice("Searching for \"" + term.join(" ") + "\"...");

        get(searcherBrowser, "http://linkedin.com/vsearch/p?" + term.join("+"), function() {
            waitFor(searcherBrowser, "#results.search-results", function () {
                getAllSearchResults(searcherBrowser, "[" + term.join(" ") + "]", function (ids) {
                    crawl(searcherBrowser, viewerBrowsers, ids, ids.length, "[" + term.join(" ") + "]", function () {
                        search(searcherBrowser, viewerBrowsers, emails, passwords, index+1, callback);
                    });
                });
            });
        });
    }, function() {
        // Failure callback.
        callback();
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
        if (_result.length >= 400) {
            notice(logPrefix + " search capped at " + _result.length + " results.");
            callback(_result);
        }
        if (result && result.next) {
            notice(logPrefix + " getting search results for page " + result.next.split("page_num=")[1] + "...");
            var next;
            if (result.next.indexOf("linkedin.com") == -1) {
                next = "http://www.linkedin.com" + result.next;
            } else {
                next = result.next;
            }
            get(browser, next, function() {
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
    get(browser, "http://www.linkedin.com/profile/view?id=" + id, function() {
        browser.executeAsync(async_getUserResult, function (err, result) {
            callback(err, result);
        });
    });
}

//-------------------------------------------------------------------------------------//
// Client Methods
//-------------------------------------------------------------------------------------//

function removeNullOrEmptyEntries(arr) {
    return arr.filter(function(n) {
        return n != undefined && n.length > 0
    });
}

Meteor.methods({
    crawl: function (value, emails, passwords, keywords, locations) {
        this.unblock();

        crawling = value;
        terms = [];
        locations = (locations || "").split(',');

        (keywords || "").split(',').forEach(function(term) {
            term = term.split(" ");
            locations.forEach(function(loc) {
                loc = loc.split(" ");
                terms.push(removeNullOrEmptyEntries(term.concat(loc)));
            });
        });

        if (crawling) {
            notice("Starting crawl...");
            console.log(terms);
            go(searcherBrowser, viewerBrowsers, emails, passwords, function() {
                crawling = false;
            });
        }
    },
    status: function () {
        return status;
    },
    csv: function () {
        var usersList = [];
        users.find().forEach(function(user) {
            var id = user.id;
            var name = user.name;
            var locality = (user.locality == undefined || user.locality.length == 0) ?
                           'N/A' : user.locality.replace(/,/g, '');
            var headline = (user.headline == undefined || user.headline.length == 0) ?
                           'N/A' : user.headline.replace(/,/g, '');

            usersList.push(id + ',' + name + ',' + locality + ',' + headline);

        });
        data = usersList.join('\n');

        fs.mkdir('/tmp/linkedin/', 0755, function(err) {
            fs.writeFile('/tmp/linkedin/leads.csv', data, function(err) {
                if(err) {
                    console.log(err);
                }
            });
        });
        return true;
    },
    crawling: function() {
        return crawling;
    }
});
