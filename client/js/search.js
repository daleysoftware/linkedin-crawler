var searching = false,
    email = "",
    password = "",
    text = "",
    previous = "";

/**
 * Enable or disable crawl button depending on entry
 */
function update(event, self) {
    var $button = $(self.find("button"));
    email = $(self.find("#email")).val();
    password = $(self.find("#password")).val();
    text = $(self.find("#text")).val();
    if (text.length && email.length && password.length) {
        $button.removeAttr("disabled");
        if (previous !== text) {
            previous = text;
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
    Meteor.call("crawl", searching, email, password, text);
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