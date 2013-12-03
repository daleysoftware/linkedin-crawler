// define a new collection using the global scope
users = new Meteor.Collection("users");

if (Meteor.isClient) {
    Template.users.users = function () {
        return users.find();
    };
    Template.users.count = function () {
        return users.find().count()
    };

}
