var searching = false,
    emails = [],
    passwords = [],
    keywords = "",
    locations = "",
    previous = "";

function removeNullOrEmptyEntries(arr) {
    return arr.filter(function(n) {
        return n != undefined && n.length > 0
    });
}

/**
 * Enable or disable crawl button depending on entry
 */
function update(event, self) {
    var $button = $(self.find("button"));

    emails = [$(self.find("#email")).val()].concat(
        removeNullOrEmptyEntries([
            $(self.find("#email-viewer-1")).val(),
            $(self.find("#email-viewer-2")).val(),
            $(self.find("#email-viewer-3")).val(),
            $(self.find("#email-viewer-4")).val()]));

    passwords = [$(self.find("#password")).val()].concat(
        removeNullOrEmptyEntries([
            $(self.find("#password-viewer-1")).val(),
            $(self.find("#password-viewer-2")).val(),
            $(self.find("#password-viewer-3")).val(),
            $(self.find("#password-viewer-4")).val()]));

    keywords = $(self.find("#keywords")).val();
    locations = $(self.find("#locations")).val();

    if (emails[0].length > 0 && passwords[0].length > 0 && keywords.length) {
        $button.removeAttr("disabled");
        if (previous !== keywords) {
            previous = keywords;
            searching = false;
        }
    } else {
        $button.attr("disabled", "disabled");
        searching = false;
    }

    $button.toggleClass("btn-primary", searching);
}

/**
 * Click handler on search button
 */
function click(event) {
    searching = !searching;
    update.apply(this, arguments);
    Meteor.call("crawl", searching, emails, passwords, keywords, locations);
}

/**
 * Submit handler on form
 */
function submit(event) {
    event.preventDefault();
}

Template.search.events({
    'click button': click,
    'keypress input[type=text]': update,
    'keyup input[type=text]': update,
    'submit .search': submit
});
