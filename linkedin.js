// Define a new collection using the global scope.
users = new Meteor.Collection("users");

if (Meteor.isClient) {
    Template.users.users = function () {
        console.log(users.find({}, {sort: {date: -1}, limit: 20}));
        return users.find({}, {sort: {date: -1}, limit: 20});
    };

    Template.users.count = function () {
        return users.find().count()
    };

    Template.users.csv = function () {
        var usersList = [];

        users.find().forEach(function(user) {
            usersList.push(user.id + ',' + user.name + ',' + user.locality.replace(/,/g, ''));
        });

        return encodeURIComponent(usersList.join('\n'));
    };
}
