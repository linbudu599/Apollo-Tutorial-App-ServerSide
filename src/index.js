const { ApolloServer } = require("apollo-server");
const isEmail = require("isemail");

const typeDefs = require("./schema");
const resolvers = require("./resolvers");
const { createStore } = require("./utils");

const LaunchAPI = require("./datasources/launch");
const UserAPI = require("./datasources/user");

const store = createStore();

const server = new ApolloServer({
  context: async ({ req }) => {
    // simple auth check on every request
    const auth = (req.headers && req.headers.authorization) || "";
    const email = Buffer.from(auth, "base64").toString("ascii");
    if (!isEmail.validate(email)) return { user: null };
    // find a user by their email
    const users = await store.users.findOrCreate({ where: { email } });
    const user = (users && users[0]) || null;

    return { user: { ...user.dataValues } };
  },
  typeDefs,
  // Apollo Server will automatically add the launchAPI and userAPI to resolvers' context
  resolvers,
  dataSources: () => ({
    // data from restful api
    launchAPI: new LaunchAPI(),
    // data from database
    userAPI: new UserAPI({ store })
  })
});

server.listen(4000).then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`);
});
