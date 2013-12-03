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
var wd = Npm.require('wd');
var Fiber = Npm.require('fibers');
var Asserter = wd.Asserter;
var browser = wd.remote('localhost', 9134);
var fs = Npm.require('fs');
var crawling = false;
var items = [];
var status = "";


//-------------------------------------------------------------------------------------//
// HELPERS
//-------------------------------------------------------------------------------------//

/**
 * Always true asserter
 * @type {Asserter}
 */
var asserter = new Asserter(
    function(target, cb) {
        cb(null, true, target);
    }
);

/**
 * Get a new session on LinkedIn
 * @param callback
 */
function newSession(callback) {
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
 * @param selector {String}
 * @param text {String}
 * @param callback {Function}
 */
function input(selector, text, callback) {
    browser.elementByCssSelector(selector, function (err, el) {
        browser.type(el, text, callback);
    });
}

/**
 * Click on an item
 * @param selector {String}
 * @param callback {Function}
 */
function click(selector, callback) {
    browser.elementByCssSelector(selector, function (err, el) {
        el.click(callback);
    });
}

/**
 * Submit a form
 * @param selector {String}
 * @param callback {Function}
 */
function submit(selector, callback) {
    browser.elementByCssSelector(selector, function (err, el) {
        el.submit(callback);
    });
}

/**
 * Wait for an element
 * @param selector {String}
 * @param callback {Function}
 */
function waitFor(selector, callback) {
    browser.waitForElementByCssSelector(selector, asserter, 10000, 200, function (err, satis, el) {
        callback(!err);
    });
}

/**
 * Create a screenshot
 * @param path {String}
 */
function screen(path) {
    browser.takeScreenshot(function (err, data) {
        fs.writeFileSync(path, data, 'base64');
    });
}

/**
 * Get the source code
 * @param selector {String} (default = body)
 * @param callback {Function}
 */
function source(selector, callback) {
    browser.execute(function () {return $(selector || 'body').html(); }, function (err, result) {
        callback(err ? false : result);
    });
}

/**
 * Notice some message
 * @param msg {string}
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
 * @returns {{ids: Array, next: boolean}}
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
 * @param callback
 */
function async_getUserResult(callback) {
    var result = {},
        $card = $("#top-card");

    /**
     * Get all public connections from a user recursively (use the js pagination)
     * @param callback {Function}
     * @param _ids {Array}
     */
    /*
    function getConnections(callback, _ids) {
        var timer,
            $connections = $("#connections");

        _ids = _ids || [];

        if ($connections.length) {
            timer = setInterval(function () {
                var $ul = $(".cardstack-container ul", $connections),
                    $button = $connections.find("button.next");

                if (!$ul.hasClass("crawled")) {
                    $ul.addClass("crawled");
                    $ul.find("li").each(function () {
                        var id = $(this).attr("id").replace("connection-", "");
                        _ids.push(id);
                    });
                    if ($button.length && !$button.hasClass("hide")) {
                        $button.click()
                    } else {
                        clearInterval(timer);
                        callback(_ids);
                    }
                }
            }, 200);

        } else {
            callback(_ids)
        }
    }
    */

    if ($card.length) {
        result.picture = $(".profile-picture img", $card).attr("src");
        result.name = $("span.full-name", $card).text();
        result.headline = $("#headline", $card).text();
        result.locality = $("#location .locality", $card).text();
        result.industry = $("#location .industry", $card).text();
        callback(result);
        /*
        getConnections(function (ids) {
            result.connections = ids;
            callback(result);
        });
        */
    } else {
        callback(false);
    }
}

//-------------------------------------------------------------------------------------//
// BUSINESS
//-------------------------------------------------------------------------------------//

/**
 * Signin to LinkedIn
 * @param email {String}
 * @param password {String}
 * @param callback {Function}
 */
function connect(email, password, callback) {
    notice("connecting...");

    browser.init(settings, function() {
        newSession(function () {
            input("#session_key-login", email, function () {
                input("#session_password-login", password, function () {
                    submit("#login", function () {
                        waitFor(".nav-item.account-settings-tab", callback);
                    });
                });
            });
        });
    });
}

/**
 * Submit a new search
 */
function search() {
    notice("searching...");

    input("#main-search-box", items.join(" "), function () {
        submit("#global-search", function () {
            waitFor("#results.search-results", function () {
                getAllSearchResults(function (ids) {
                    crawl(ids, function () {
                        notice("Crawl ends.")
                    });
                });
            });
        });

    });
}


/**
 * Collect all search matching UserId from all pages available
 * @param callback {Function}
 * @param _result {Array} optional, only used in recursive call
 */

function getAllSearchResults(callback, _result) {
    _result = _result || [];
    notice("collecting search result ...");
    browser.execute(getSearchResults, function (err, result) {
        if (result && result.ids && result.ids.length) {
            _result.push.apply(_result, result.ids);
        }
        if (result && result.next) {
            notice("getting next results:" + result.next);
            browser.get("http://www.linkedin.com" + result.next, function() {
                getAllSearchResults(callback, _result);
            });
        } else {
            notice("search ends with " + _result.length + " result(s)");
            callback(_result);
        }
    });
}


/**
 * Crawl the users
 * @param ids {Array}
 * @param callback {Function}
 */
function crawl(ids, callback) {
    Fiber(function () {
        var id, test;

        // look for next id unknown
        while (crawling && (id = ids.shift()) && users.find({id: id}).count()) {
            test = id;
        }

        if (crawling && id && test !== id) { // id defined and not in db
            getUser(id, function () {
                crawl(ids, callback);
            })
        } else {
            callback();
        }
    }).run();
}

//top-card

/**
 * Get User data from LinkedIN
 * @param id {string}
 * @param callback {Function}
 */
function getUser(id, callback) {
    browser.get("http://www.linkedin.com/profile/view?id=" + id, function() {
        browser.executeAsync(async_getUserResult, function (err, result) {
            Fiber(function () {
                if (!err && result) {
                    notice("Saving " + result.name);
                    result.id = id;
                    users.insert(result);
                }
                callback();
            }).run();
        });
    });
}



//-------------------------------------------------------------------------------------//
// PUBLISH METHODS TO THE CLIENT
//-------------------------------------------------------------------------------------//

Meteor.methods({
    crawl: function (value, email, password, text) {
        this.unblock();
        crawling = value;
        items = (text || "").replace(/\s+/g, " ").split(" ");
        if (crawling) {
            connect(email, password, search);
        }
    },
    status: function () {
        return status;
    }
});