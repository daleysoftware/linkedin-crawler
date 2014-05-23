var prevStatus = "";

setInterval(function () {
    Meteor.call("status", function (err, status) {
        if (prevStatus !== status) {
            prevStatus = status;
            $("#status span").text(status);
        }
    });
}, 350);
