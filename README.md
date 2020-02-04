# Apollo-Tutorial-App-ServerSide

> Apollo实践 全栈App 服务端部分
>
> 基于 [SpaceX API](https://github.com/r-spacex/SpaceX-API) 提供的 Restful API 以及 [Apollo-Server](https://github.com/apollographql/apollo-server)
>
<!-- > 如果需要更好的阅读体验，请移步 [我的博客]()  -->

## 开始

- 这篇文章假设你已经了解 `GraphQL` 的基础知识，至少包括 `Schema`、`Resolver` 以及 `Query`类型和 `Mutation` 类型。

- [Apollo-Server](https://github.com/apollographql/apollo-server) 提供为一些 **web框架** 定制的上层封装，如 [Apollo-Server-Koa](https://github.com/apollographql/apollo-server/tree/master/packages/apollo-server-koa) 等，但在这里我直接使用原生的 `Apollo-Server`。

- 官方文档请见 [这里](https://www.apollographql.com/docs/)，其中有对包括服务端和客户端的详细分析。

- 那么我们开始吧。

## 使用 Apollo-Server 启动一个 GraphQL 服务器

> 完整源码见 [index.js](src/index.js)

```javascript
const { ApolloServer } = require("apollo-server");
const typeDefs = require("./schema");
const resolvers = require("./resolvers");

const server = new ApolloServer({
  typeDefs,
  resolvers
});

server.listen(4000).then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`);
});
```

如果使用过 `GraphQL`，你应该能从上面的代码里大致猜到 `Apollo-Server` 实际上就是一层GraphQL封装，在上面我们提供了 类型定义（`typeDefs`）和对应的解析器（`resolvers`）。并且启动了一个服务，访问控制台中打印的地址，即是一个集可视化调试与文档于一体的平台，`GraphQL Playground`，类似于 `GraphiQL`。

## 类型定义与解析器

### 类型定义

与原生 `GraphQL` 的语法相同，你定义一个根查询树，并规定每个子查询树的入参（如果有的话）以及返回值，在这里你无需使用 `GraphQLString()` 或是 `GraphQLObjectType({})` 等来进行规范类型，而是可以直接使用 `String` 或者 `{}`。同样的，使用一个子类型来规范某个查询的返回值也是类似的方法。如：

```javascript
const typeDefs = gql`
  type Query {
    launch(id: ID!): Launch
    me: User
  }
  type Launch {
    id: ID!
    site: String
    rocket: Rocket
    isBooked: Boolean!
  }
  type Rocket {
    id: ID!
    name: String
    type: String
  }

  type Mutation {
    bookTrips(launchIds: [ID]!): TripUpdateResponse!
    cancelTrip(launchId: ID!): TripUpdateResponse!
    login(email: String): String
  }

  type TripUpdateResponse {
    success: Boolean!
    message: String
    launches: [Launch]
  }
`
```

### 解析器

解析器是较为重要的部分，它关系到如何去获取数据（API/数据库），并将数据处理成类型定义中要求的“形状”，如果是 `Mutation` 操作，你还可以在数据被写入到数据库前进行一些额外处理。

一个 `resolver` 具有四个参数:

- **parentValue**，如果当前解析器处理的是一个子类型，那么此时的值即为父类型所有的查询结果，除了它自己。（有多个子类型的情况我还没尝试）并且这个值会包含父类型所有的返回值，而不仅仅是在发起查询时要求的值。举例：

以上面的类型定义为例，发起一个这样的查询

```graphql
query {
  launch(id:1){
    id
    isBooked
  }
}
```

```javascript
// 解析器
 Launch: {
    isBooked: async (launch, _, ctx) => {
      console.log(launch);
      ctx.dataSources.userAPI.isBookedOnLaunch({ launchId: launch.id });
    }
  }
```

打印出的 `launch` 值如下

```javascript
{
  id: 1,
  cursor: '1143239400',
  site: 'Kwajalein Atoll',
  mission: {
    name: 'FalconSat',
    missionPatchSmall: 'https://images2.imgbox.com/3c/0e/T8iJcSN3_o.png',
    missionPatchLarge: 'https://images2.imgbox.com/40/e3/GypSkayF_o.png' 
  },
  rocket: { id: 'falcon1', name: 'Falcon 1', type: 'Merlin A' }
}
```

- **args**，即你在发起查询/变更请求时携带的参数。

- **context**，context是一个会在所有 GraphQL 请求间共享的一个上下文，在这个APP中，我们会借助 `Apollo-Server` ，把用户信息、数据集（库）都添加到这里。以此在解析器里进行鉴权、数据查询/变更等操作。

- **info**，info中存储着操作的执行状态，只应当在复杂应用中使用（官方文档说的，我也觉得我还没到那层次...）

## 连接 RESTFUL API

在很多情况下不可能为了使用 `GraphQL` 而直接重构后端的API，因此在这种情况下就需要使用 `Apollo-datasource-rest` 来连接REST API。详细配置见 [launch.js](src/datasources/launch.js)。

```JavaScript
// index.js
const server = new ApolloServer({
  typeDefs,
  // Apollo Server will automatically add the launchAPI and userAPI to resolvers' context
  resolvers,
  dataSources: () => ({
    // data from restful api
    launchAPI: new LaunchAPI(),
  })
});

// launch.js

const { RESTDataSource } = require("apollo-datasource-rest");

class LaunchAPI extends RESTDataSource {
  constructor() {
    super();
    this.baseURL = "https://api.spacexdata.com/v2/";
  }

  async getAllLaunches() {
    // GET https://api.spacexdata.com/v2/launches
    const response = await this.get("launches");
    return Array.isArray(response)
      ? response.map(launch => this.launchReducer(launch))
      : [];
  }

  // there is more...
}

module.exports = LaunchAPI;

```

通过这种方式，我们就可以在解析器里调用这个类的方法，它被自动添加到了 `context` 参数中。

你可以这样使用它：

```javascript
 launches: async (_, { pageSize = 20, after }, { dataSources }) => {
      const allLaunches = await dataSources.launchAPI.getAllLaunches();
      ...
  }
```

通常情况下我们从后端取回的数据不会刚好符合在类型定义中要求的形状，因此你也可以在这个类中额外定义一些处理逻辑。

## 连接数据库

> 读懂这个例子并不需要你有数据库知识。你只需要直到大致的连接方法即可，同样使用哪种数据库和ORM也是自由的。源码见 [user.js](src/datasources/user.js)

类似于上面连接 REST API ， 你需要一个额外的包来允许你连接到数据库，即 `Apollo-datasource`。

```javascript
const { DataSource } = require("apollo-datasource");
const isEmail = require("isemail");

class UserAPI extends DataSource {
  constructor({ store }) {
    super();
    this.store = store;
  }

  // 连接GQL API上下文
  initialize(config) {
    // 一个在所有解析器中共享的上下文对象
    this.context = config.context;
  }

  async findOrCreateUser({ email: emailArg } = {}) {
    const email =
      this.context && this.context.user ? this.context.user.email : emailArg;
    if (!email || !isEmail.validate(email)) return null;

    const users = await this.store.users.findOrCreate({ where: { email } });
    return users && users[0] ? users[0] : null;
  }

  // Also,there is more...
}

module.exports = UserAPI;

```

有几个需要注意的地方：

- `initialize` 方法，如果需要传入自己的配置，就需要实现这个方法，在这里我们也需要使用这个方法来连接到 GraphQL Context

- `this.context`， 即我们上面讲到的 `context` 参数，用于连接数据库和存储用户信息

- `this.store`，我们再补齐 `index.js` 中的代码

```javascript
const { createStore } = require("./utils");
const store = createStore();

const server = new ApolloServer({
  typeDefs,
  resolvers,
  dataSources: () => ({
    // data from restful api
    launchAPI: new LaunchAPI(),
    // data from database
    userAPI: new UserAPI({ store })
  })
});
```

我们先不管 `createStore()` 方法，只要知道它是一个内部连接到SQLite（这个app使用的是sequelize+sqlite3）并暴露出两个数据库实例（`users` & `trips`）的方法即可。我们将它传入UserAPI的constructor方法，然后就可以通过`this.store.users.findOrCreate()`这样的方式来操作数据库了。注意这里的`findOrCreate` 是ORM的方法。

## 总结

Apollo并没有使得使用 GraphQL 的难度提升，相反，它很好的封装了诸如连接到REST API、使用数据库的逻辑，使得开发者不需要再去操心这些。同时，[Apollo Graph Manager](https://engine.apollographql.com) 还提供了包括云存储/计算服务以及配套VS CODE插件等工具（虽然不知道为什么我没法用，上传总是超时）。

同时，Apollo有着一个庞大的生态，这篇文章介绍的服务端就像是冰山一角，它还有 `Apollo-Client`（Vue/React，还有IOS！），`Apollo-Link`，blabla...

## 客户端

客户端文章正在写作中~