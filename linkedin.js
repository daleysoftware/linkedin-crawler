// Define a new collection using the global scope.
users = new Meteor.Collection("users");

if (Meteor.isClient) {
    Template.users.count = function () {
        return users.find().count()
    };
}
