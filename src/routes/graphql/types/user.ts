import { MemberTypeId } from '../../../routes/member-types/schemas.js';
import {
  GraphQLObjectType,
  GraphQLString,
  GraphQLFloat,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLID,
  GraphQLFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLBoolean,
} from 'graphql';
import {
  PrismaClient,
  User,
  // Profile,
  // Post,
  // MemberType,
  // SubscribersOnAuthors,
} from '@prisma/client';

interface Context {
  // object that gets passed to every resolver function as the third argument
  prisma: PrismaClient;
}

// argument to createUser mutation
const CreateUserInput = new GraphQLInputObjectType({
  name: 'CreateUserInput',
  fields: {
    name: { type: new GraphQLNonNull(GraphQLString) },
    balance: { type: new GraphQLNonNull(GraphQLFloat) },
  },
});

// not wrapped in GraphQLNonNull => both name and balance are optional
const ChangeUserInput = new GraphQLInputObjectType({
  name: 'ChangeUserInput',
  fields: {
    name: { type: GraphQLString },
    balance: { type: GraphQLFloat },
  },
});

// structure of the data objects graphql API can return
export const UserType = new GraphQLObjectType({
  name: 'User',
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    balance: { type: new GraphQLNonNull(GraphQLFloat) },
    profile: { type: ProfileType }, // user => one profile, ProfileType - GraphQL type
    posts: { type: new GraphQLList(PostType) }, // user => many posts, PostType - GraphQL type
    userSubscribedTo: { type: new GraphQLList(UserType) }, // Users this user is subscribed to
    subscribedToUser: { type: new GraphQLList(UserType) }, // Users subscribed to this user
  }),
});

export const ProfileType = new GraphQLObjectType({
  name: 'Profile',
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    isMale: { type: new GraphQLNonNull(GraphQLBoolean) },
    yearOfBirth: { type: new GraphQLNonNull(GraphQLInt) },
    memberType: { type: MemberTypeType },
  }),
});

export const PostType = new GraphQLObjectType({
  name: 'Post',
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    title: { type: new GraphQLNonNull(GraphQLString) },
    content: { type: new GraphQLNonNull(GraphQLString) },
  }),
});

export const MemberTypeType = new GraphQLObjectType({
  name: 'MemberType',
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLString) },
    discount: { type: new GraphQLNonNull(GraphQLFloat) },
    postsLimitPerMonth: { type: new GraphQLNonNull(GraphQLInt) },
  }),
});

// Resolvers - fetching data from the database for a specific field in GraphQL schema
export const userResolvers: {
  // top-level query fields (all users, single user)
  Query: GraphQLFieldConfigMap<unknown, Context>;
  Mutation: GraphQLFieldConfigMap<unknown, Context>;
  // This is for field resolvers specific to UserType. If a field in UserType
  // isn't a simple scalar value directly available on the parent object
  // (e.g., profile, posts), you provide a resolver here to fetch that related data. The keys in this object
  // (profile, posts, etc.) must match field names in UserType.
  // 'User' here refers to the Prisma User type for the parent argument
  User: GraphQLFieldConfigMap<User, Context>;
} = {
  Query: {
    users: {
      type: new GraphQLList(UserType),
      resolve: async (_: unknown, __: unknown, { prisma }: Context) => {
        return prisma.user.findMany();
      },
    },
    user: {
      // as GraphQLObjectType type assertion is only used to shut ESLint up, cause UserType is
      type: UserType as GraphQLObjectType, // returns single User
      // requires and 'id' arg
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
      },
      // first arg: parent - result from parent resolver: undefined for top level Query and Muatations
      // for field resolvers (lie User.profile), parent is the instance of parent type (aka User object whose profile we fetch)
      resolve: async (_: unknown, { id }: { id: string }, { prisma }: Context) => {
        return prisma.user.findUnique({
          where: { id },
          // also fetch the related profile (and its memberType), posts, and subscription data in the same database query
          // field resolvers for profile, posts, userSubscribedTo,
          // and subscribedToUser will always perform their own Prisma query because
          // we don't check if parent.profile (etc.) already exists from an include
          include: {
            profile: {
              include: {
                memberType: true,
              },
            },
            posts: true,
            userSubscribedTo: {
              include: {
                author: true,
              },
            },
            subscribedToUser: {
              include: {
                subscriber: true,
              },
            },
          },
        });
      },
    },
  },
  Mutation: {
    createUser: {
      type: UserType as GraphQLObjectType,
      args: {
        dto: { type: CreateUserInput },
      },
      resolve: async (
        _: unknown,
        { dto }: { dto: { name: string; balance: number } },
        { prisma }: Context,
      ) => {
        return prisma.user.create({
          data: dto,
        });
      },
    },
    changeUser: {
      type: UserType as GraphQLObjectType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
        dto: { type: ChangeUserInput },
      },
      resolve: async (
        _: unknown,
        { id, dto }: { id: string; dto: { name?: string; balance?: number } },
        { prisma }: Context,
      ) => {
        return prisma.user.update({
          where: { id },
          data: dto,
        });
      },
    },
    deleteUser: {
      type: GraphQLString,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
      },
      resolve: async (_: unknown, { id }: { id: string }, { prisma }: Context) => {
        await prisma.user.delete({
          where: { id },
        });
        return 'User deleted successfully';
      },
    },
  },
  // field resolvers (for fields which require own data fetching logic)
  User: {
    profile: {
      type: ProfileType,
      // parent here is User object we query the profile for
      resolve: async (parent: User, _: unknown, { prisma }: Context) => {
        return prisma.profile.findUnique({
          where: { userId: parent.id },
          include: { memberType: true },
        });
      },
    },
    posts: {
      type: new GraphQLList(PostType),
      resolve: async (parent: User, _: unknown, { prisma }: Context) => {
        return prisma.post.findMany({
          where: { authorId: parent.id },
        });
      },
    },
    userSubscribedTo: {
      type: new GraphQLList(UserType),
      resolve: async (parent: User, _: unknown, { prisma }: Context) => {
        // Fetches through the SubscribersOnAuthors join table
        const subscriptions = await prisma.subscribersOnAuthors.findMany({
          where: { subscriberId: parent.id },
          include: { author: true }, // Include the author (the User object)
        });
        return subscriptions.map((sub) => sub.author); // Extract the author objects
      },
    },
    subscribedToUser: {
      type: new GraphQLList(UserType),
      resolve: async (parent: User, _: unknown, { prisma }: Context) => {
        // Fetches through the SubscribersOnAuthors join table
        const subscribers = await prisma.subscribersOnAuthors.findMany({
          where: { authorId: parent.id },
          include: { subscriber: true }, // Include the subscriber (the User object)
        });
        return subscribers.map((sub) => sub.subscriber); // Extract the subscriber objects
      },
    },
  },
};
