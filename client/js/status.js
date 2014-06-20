var prevStatus = "";
var prevCrawling = "";

setInterval(function () {
    Meteor.call("status", function (err, status) {
        if (prevStatus !== status) {
            prevStatus = status;
            $("#status span").text(status);
        }
    });
    Meteor.call("crawling", function (err, crawling) {
        if (prevCrawling == "") {
            prevCrawling = crawling;
            return;
        }

        if (prevCrawling != crawling) {
            prevCrawling = crawling;
            $("button[type=submit]").toggleClass("btn-primary", crawling);
        }
    });
}, 350);

setInterval(function () {
    Meteor.call("csv", function (err, status) {
        console.log("csv completed");
    });
}, 3000);
