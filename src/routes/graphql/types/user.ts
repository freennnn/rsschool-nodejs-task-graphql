import {
  GraphQLObjectType,
  GraphQLString,
  GraphQLFloat,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLBoolean,
  GraphQLOutputType,
  GraphQLEnumType,
} from 'graphql';
import { PrismaClient, User, Profile, Post } from '@prisma/client';
import { UUIDType } from './scalars.js';

interface Context {
  prisma: PrismaClient;
}

// =============================================================================
// ENUMS
// =============================================================================

export const MemberTypeIdEnumType = new GraphQLEnumType({
  name: 'MemberTypeId',
  values: {
    BASIC: { value: 'BASIC' },
    BUSINESS: { value: 'BUSINESS' },
  },
});

// =============================================================================
// INPUT TYPES
// =============================================================================

const CreateUserInput = new GraphQLInputObjectType({
  name: 'CreateUserInput',
  fields: {
    name: { type: new GraphQLNonNull(GraphQLString) },
    balance: { type: new GraphQLNonNull(GraphQLFloat) },
  },
});

const ChangeUserInput = new GraphQLInputObjectType({
  name: 'ChangeUserInput',
  fields: {
    name: { type: GraphQLString },
    balance: { type: GraphQLFloat },
  },
});

const CreateProfileInput = new GraphQLInputObjectType({
  name: 'CreateProfileInput',
  fields: {
    isMale: { type: new GraphQLNonNull(GraphQLBoolean) },
    yearOfBirth: { type: new GraphQLNonNull(GraphQLInt) },
    memberTypeId: { type: new GraphQLNonNull(MemberTypeIdEnumType) },
    userId: { type: new GraphQLNonNull(UUIDType) },
  },
});

const ChangeProfileInput = new GraphQLInputObjectType({
  name: 'ChangeProfileInput',
  fields: {
    isMale: { type: GraphQLBoolean },
    yearOfBirth: { type: GraphQLInt },
    memberTypeId: { type: MemberTypeIdEnumType },
  },
});

const CreatePostInput = new GraphQLInputObjectType({
  name: 'CreatePostInput',
  fields: {
    title: { type: new GraphQLNonNull(GraphQLString) },
    content: { type: new GraphQLNonNull(GraphQLString) },
    authorId: { type: new GraphQLNonNull(UUIDType) },
  },
});

const ChangePostInput = new GraphQLInputObjectType({
  name: 'ChangePostInput',
  fields: {
    title: { type: GraphQLString },
    content: { type: GraphQLString },
  },
});

// =============================================================================
// OBJECT TYPES (using thunk functions for circular dependencies)
// =============================================================================

export const MemberTypeType = new GraphQLObjectType({
  name: 'MemberType',
  fields: () => ({
    id: { type: new GraphQLNonNull(MemberTypeIdEnumType) },
    discount: { type: new GraphQLNonNull(GraphQLFloat) },
    postsLimitPerMonth: { type: new GraphQLNonNull(GraphQLInt) },
  }),
});

export const ProfileType = new GraphQLObjectType({
  name: 'Profile',
  fields: () => ({
    id: { type: new GraphQLNonNull(UUIDType) },
    isMale: { type: new GraphQLNonNull(GraphQLBoolean) },
    yearOfBirth: { type: new GraphQLNonNull(GraphQLInt) },
    user: {
      type: new GraphQLNonNull(UserType),
      resolve: async (parent: Profile, _: unknown, { prisma }: Context) => {
        return prisma.user.findUniqueOrThrow({ where: { id: parent.userId } });
      },
    },
    userId: { type: new GraphQLNonNull(UUIDType) },
    memberType: {
      type: new GraphQLNonNull(MemberTypeType),
      resolve: async (parent: Profile, _: unknown, { prisma }: Context) => {
        return prisma.memberType.findUniqueOrThrow({
          where: { id: parent.memberTypeId },
        });
      },
    },
    memberTypeId: { type: new GraphQLNonNull(MemberTypeIdEnumType) },
  }),
});

export const PostType = new GraphQLObjectType({
  name: 'Post',
  fields: () => ({
    id: { type: new GraphQLNonNull(UUIDType) },
    title: { type: new GraphQLNonNull(GraphQLString) },
    content: { type: new GraphQLNonNull(GraphQLString) },
    author: {
      type: new GraphQLNonNull(UserType),
      resolve: async (parent: Post, _: unknown, { prisma }: Context) => {
        return prisma.user.findUniqueOrThrow({ where: { id: parent.authorId } });
      },
    },
    authorId: { type: new GraphQLNonNull(UUIDType) },
  }),
});

export const UserType = new GraphQLObjectType({
  name: 'User',
  fields: () => ({
    id: { type: new GraphQLNonNull(UUIDType) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    balance: { type: new GraphQLNonNull(GraphQLFloat) },
    profile: {
      type: ProfileType as GraphQLOutputType,
      resolve: async (parent: User, _: unknown, { prisma }: Context) => {
        return prisma.profile.findUnique({ where: { userId: parent.id } });
      },
    },
    posts: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(PostType))),
      resolve: async (parent: User, _: unknown, { prisma }: Context) => {
        return prisma.post.findMany({ where: { authorId: parent.id } });
      },
    },
    userSubscribedTo: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(UserType))),
      resolve: async (parent: User, _: unknown, { prisma }: Context) => {
        const subscriptions = await prisma.subscribersOnAuthors.findMany({
          where: { subscriberId: parent.id },
          include: { author: true },
        });
        return subscriptions.map((sub) => sub.author);
      },
    },
    subscribedToUser: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(UserType))),
      resolve: async (parent: User, _: unknown, { prisma }: Context) => {
        const subscribers = await prisma.subscribersOnAuthors.findMany({
          where: { authorId: parent.id },
          include: { subscriber: true },
        });
        return subscribers.map((sub) => sub.subscriber);
      },
    },
  }),
});

// =============================================================================
// RESOLVERS
// =============================================================================

export const rootResolvers: {
  Query: GraphQLFieldConfigMap<unknown, Context>;
  Mutation: GraphQLFieldConfigMap<unknown, Context>;
} = {
  Query: {
    // User Queries
    users: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(UserType)),
      ) as GraphQLOutputType,
      resolve: async (_: unknown, __: unknown, { prisma }: Context) => {
        return prisma.user.findMany();
      },
    },
    user: {
      type: UserType as GraphQLOutputType,
      args: { id: { type: new GraphQLNonNull(UUIDType) } },
      resolve: async (_: unknown, { id }: { id: string }, { prisma }: Context) => {
        return prisma.user.findUnique({ where: { id } });
      },
    },

    // Profile Queries
    profiles: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(ProfileType)),
      ) as GraphQLOutputType,
      resolve: async (_: unknown, __: unknown, { prisma }: Context) => {
        return prisma.profile.findMany();
      },
    },
    profile: {
      type: ProfileType as GraphQLOutputType,
      args: { id: { type: new GraphQLNonNull(UUIDType) } },
      resolve: async (_: unknown, { id }: { id: string }, { prisma }: Context) => {
        return prisma.profile.findUnique({ where: { id } });
      },
    },

    // Post Queries
    posts: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(PostType)),
      ) as GraphQLOutputType,
      resolve: async (_: unknown, __: unknown, { prisma }: Context) => {
        return prisma.post.findMany();
      },
    },
    post: {
      type: PostType as GraphQLOutputType,
      args: { id: { type: new GraphQLNonNull(UUIDType) } },
      resolve: async (_: unknown, { id }: { id: string }, { prisma }: Context) => {
        return prisma.post.findUnique({ where: { id } });
      },
    },

    // MemberType Queries
    memberTypes: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(MemberTypeType)),
      ) as GraphQLOutputType,
      resolve: async (_: unknown, __: unknown, { prisma }: Context) => {
        return prisma.memberType.findMany();
      },
    },
    memberType: {
      type: MemberTypeType as GraphQLOutputType,
      args: { id: { type: new GraphQLNonNull(MemberTypeIdEnumType) } },
      resolve: async (_: unknown, { id }: { id: string }, { prisma }: Context) => {
        return prisma.memberType.findUnique({ where: { id } });
      },
    },
  },

  Mutation: {
    // User Mutations
    createUser: {
      type: new GraphQLNonNull(UserType) as GraphQLOutputType,
      args: { dto: { type: new GraphQLNonNull(CreateUserInput) } },
      resolve: async (
        _: unknown,
        { dto }: { dto: { name: string; balance: number } },
        { prisma }: Context,
      ) => {
        return prisma.user.create({ data: dto });
      },
    },
    changeUser: {
      type: new GraphQLNonNull(UserType) as GraphQLOutputType,
      args: {
        id: { type: new GraphQLNonNull(UUIDType) },
        dto: { type: new GraphQLNonNull(ChangeUserInput) },
      },
      resolve: async (
        _: unknown,
        { id, dto }: { id: string; dto: { name?: string; balance?: number } },
        { prisma }: Context,
      ) => {
        return prisma.user.update({ where: { id }, data: dto });
      },
    },
    deleteUser: {
      type: new GraphQLNonNull(GraphQLString) as GraphQLOutputType,
      args: { id: { type: new GraphQLNonNull(UUIDType) } },
      resolve: async (_: unknown, { id }: { id: string }, { prisma }: Context) => {
        await prisma.user.delete({ where: { id } });
        return 'User deleted successfully';
      },
    },

    // Profile Mutations
    createProfile: {
      type: new GraphQLNonNull(ProfileType) as GraphQLOutputType,
      args: { dto: { type: new GraphQLNonNull(CreateProfileInput) } },
      resolve: async (
        _: unknown,
        {
          dto,
        }: {
          dto: {
            isMale: boolean;
            yearOfBirth: number;
            memberTypeId: string;
            userId: string;
          };
        },
        { prisma }: Context,
      ) => {
        return prisma.profile.create({ data: dto });
      },
    },
    changeProfile: {
      type: new GraphQLNonNull(ProfileType) as GraphQLOutputType,
      args: {
        id: { type: new GraphQLNonNull(UUIDType) },
        dto: { type: new GraphQLNonNull(ChangeProfileInput) },
      },
      resolve: async (
        _: unknown,
        {
          id,
          dto,
        }: {
          id: string;
          dto: { isMale?: boolean; yearOfBirth?: number; memberTypeId?: string };
        },
        { prisma }: Context,
      ) => {
        return prisma.profile.update({ where: { id }, data: dto });
      },
    },
    deleteProfile: {
      type: new GraphQLNonNull(GraphQLString) as GraphQLOutputType,
      args: { id: { type: new GraphQLNonNull(UUIDType) } },
      resolve: async (_: unknown, { id }: { id: string }, { prisma }: Context) => {
        await prisma.profile.delete({ where: { id } });
        return 'Profile deleted successfully';
      },
    },

    // Post Mutations
    createPost: {
      type: new GraphQLNonNull(PostType) as GraphQLOutputType,
      args: { dto: { type: new GraphQLNonNull(CreatePostInput) } },
      resolve: async (
        _: unknown,
        { dto }: { dto: { title: string; content: string; authorId: string } },
        { prisma }: Context,
      ) => {
        return prisma.post.create({ data: dto });
      },
    },
    changePost: {
      type: new GraphQLNonNull(PostType) as GraphQLOutputType,
      args: {
        id: { type: new GraphQLNonNull(UUIDType) },
        dto: { type: new GraphQLNonNull(ChangePostInput) },
      },
      resolve: async (
        _: unknown,
        { id, dto }: { id: string; dto: { title?: string; content?: string } },
        { prisma }: Context,
      ) => {
        return prisma.post.update({ where: { id }, data: dto });
      },
    },
    deletePost: {
      type: new GraphQLNonNull(GraphQLString) as GraphQLOutputType,
      args: { id: { type: new GraphQLNonNull(UUIDType) } },
      resolve: async (_: unknown, { id }: { id: string }, { prisma }: Context) => {
        await prisma.post.delete({ where: { id } });
        return 'Post deleted successfully';
      },
    },

    // Subscription Management Mutations
    subscribeTo: {
      type: new GraphQLNonNull(GraphQLString) as GraphQLOutputType,
      args: {
        userId: { type: new GraphQLNonNull(UUIDType) },
        authorId: { type: new GraphQLNonNull(UUIDType) },
      },
      resolve: async (
        _: unknown,
        { userId, authorId }: { userId: string; authorId: string },
        { prisma }: Context,
      ) => {
        await prisma.subscribersOnAuthors.create({
          data: { subscriberId: userId, authorId: authorId },
        });
        return 'Subscription created successfully';
      },
    },
    unsubscribeFrom: {
      type: new GraphQLNonNull(GraphQLString) as GraphQLOutputType,
      args: {
        userId: { type: new GraphQLNonNull(UUIDType) },
        authorId: { type: new GraphQLNonNull(UUIDType) },
      },
      resolve: async (
        _: unknown,
        { userId, authorId }: { userId: string; authorId: string },
        { prisma }: Context,
      ) => {
        await prisma.subscribersOnAuthors.delete({
          where: {
            subscriberId_authorId: { subscriberId: userId, authorId: authorId },
          },
        });
        return 'Unsubscribed successfully';
      },
    },
  },
};
