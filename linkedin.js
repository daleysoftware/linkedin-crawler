// Define a new collection using the global scope.
users = new Meteor.Collection("users");

if (Meteor.isClient) {
    Template.users.users = function () {
        return users.find({}, {sort: {date: -1}, limit: 20});
    };
    Template.users.count = function () {
        return users.find().count()
    };
}
