var searching = false,
    email = "",
    password = "",
    terms = "",
    locations = "",
    previous = "";

/**
 * Enable or disable crawl button depending on entry
 */
function update(event, self) {
    var $button = $(self.find("button"));

    email = $(self.find("#email")).val();
    password = $(self.find("#password")).val();
    terms = $(self.find("#terms")).val();
    locations = $(self.find("#locations")).val();

    if (email.length && password.length && terms.length) {
        $button.removeAttr("disabled");
        if (previous !== terms) {
            previous = terms;
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
    Meteor.call("crawl", searching, email, password, terms, locations);
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
