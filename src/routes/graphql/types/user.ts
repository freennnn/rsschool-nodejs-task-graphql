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
  GraphQLResolveInfo,
} from 'graphql';
import { PrismaClient, User, Profile, Post, MemberType } from '@prisma/client';
import DataLoader from 'dataloader';
import { parseResolveInfo, ResolveTree } from 'graphql-parse-resolve-info';
import { UUIDType } from './scalars.js';

interface Context {
  prisma: PrismaClient;
  userLoader: DataLoader<string, User | null>;
  profileLoader: DataLoader<string, Profile | null>;
  postsByAuthorLoader: DataLoader<string, Post[]>;
  memberTypeLoader: DataLoader<string, MemberType | null>;
  userSubscribedToLoader: DataLoader<string, User[]>;
  subscribedToUserLoader: DataLoader<string, User[]>;
}

// =============================================================================
// DATALOADER FUNCTIONS
// =============================================================================

const createUserLoader = (prisma: PrismaClient) =>
  new DataLoader<string, User | null>(async (ids) => {
    const users = await prisma.user.findMany({
      where: { id: { in: [...ids] } },
    });
    return ids.map((id) => users.find((user) => user.id === id) || null);
  });

const createProfileLoader = (prisma: PrismaClient) =>
  new DataLoader<string, Profile | null>(async (userIds) => {
    const profiles = await prisma.profile.findMany({
      where: { userId: { in: [...userIds] } },
    });
    return userIds.map(
      (userId) => profiles.find((profile) => profile.userId === userId) || null,
    );
  });

const createPostsByAuthorLoader = (prisma: PrismaClient) =>
  new DataLoader<string, Post[]>(async (authorIds) => {
    const posts = await prisma.post.findMany({
      where: { authorId: { in: [...authorIds] } },
    });
    return authorIds.map((authorId) =>
      posts.filter((post) => post.authorId === authorId),
    );
  });

const createMemberTypeLoader = (prisma: PrismaClient) =>
  new DataLoader<string, MemberType | null>(async (ids) => {
    const memberTypes = await prisma.memberType.findMany({
      where: { id: { in: [...ids] } },
    });
    return ids.map((id) => memberTypes.find((mt) => mt.id === id) || null);
  });

const createUserSubscribedToLoader = (prisma: PrismaClient) =>
  new DataLoader<string, User[]>(async (subscriberIds) => {
    const subscriptions = await prisma.subscribersOnAuthors.findMany({
      where: { subscriberId: { in: [...subscriberIds] } },
      include: { author: true },
    });
    return subscriberIds.map((subscriberId) =>
      subscriptions
        .filter((sub) => sub.subscriberId === subscriberId)
        .map((sub) => sub.author),
    );
  });

const createSubscribedToUserLoader = (prisma: PrismaClient) =>
  new DataLoader<string, User[]>(async (authorIds) => {
    const subscriptions = await prisma.subscribersOnAuthors.findMany({
      where: { authorId: { in: [...authorIds] } },
      include: { subscriber: true },
    });
    return authorIds.map((authorId) =>
      subscriptions
        .filter((sub) => sub.authorId === authorId)
        .map((sub) => sub.subscriber),
    );
  });

export const createLoaders = (prisma: PrismaClient) => ({
  userLoader: createUserLoader(prisma),
  profileLoader: createProfileLoader(prisma),
  postsByAuthorLoader: createPostsByAuthorLoader(prisma),
  memberTypeLoader: createMemberTypeLoader(prisma),
  userSubscribedToLoader: createUserSubscribedToLoader(prisma),
  subscribedToUserLoader: createSubscribedToUserLoader(prisma),
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

interface UserWithSubscriptions extends User {
  userSubscribedTo?: Array<{ subscriberId: string; authorId: string }>;
  subscribedToUser?: Array<{ subscriberId: string; authorId: string }>;
}

const shouldIncludeField = (info: GraphQLResolveInfo, fieldName: string): boolean => {
  const parsedInfo = parseResolveInfo(info) as ResolveTree;
  return Boolean(parsedInfo?.fieldsByTypeName?.User?.[fieldName]);
};

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
      resolve: async (parent: Profile, _: unknown, { userLoader }: Context) => {
        return userLoader.load(parent.userId);
      },
    },
    userId: { type: new GraphQLNonNull(UUIDType) },
    memberType: {
      type: new GraphQLNonNull(MemberTypeType),
      resolve: async (parent: Profile, _: unknown, { memberTypeLoader }: Context) => {
        return memberTypeLoader.load(parent.memberTypeId);
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
      resolve: async (parent: Post, _: unknown, { userLoader }: Context) => {
        return userLoader.load(parent.authorId);
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
      resolve: async (parent: User, _: unknown, { profileLoader }: Context) => {
        return profileLoader.load(parent.id);
      },
    },
    posts: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(PostType))),
      resolve: async (parent: User, _: unknown, { postsByAuthorLoader }: Context) => {
        return postsByAuthorLoader.load(parent.id);
      },
    },
    userSubscribedTo: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(UserType))),
      resolve: async (
        parent: User & { userSubscribedTo?: Array<{ authorId: string }> },
        _: unknown,
        { userSubscribedToLoader, userLoader }: Context,
      ) => {
        // Use included subscription data if available, otherwise fetch via DataLoader
        if (parent.userSubscribedTo) {
          const authorIds = parent.userSubscribedTo.map((sub) => sub.authorId);
          return Promise.all(authorIds.map((id) => userLoader.load(id)));
        }
        return userSubscribedToLoader.load(parent.id);
      },
    },
    subscribedToUser: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(UserType))),
      resolve: async (
        parent: User & { subscribedToUser?: Array<{ subscriberId: string }> },
        _: unknown,
        { subscribedToUserLoader, userLoader }: Context,
      ) => {
        // Use included subscription data if available, otherwise fetch via DataLoader
        if (parent.subscribedToUser) {
          const subscriberIds = parent.subscribedToUser.map((sub) => sub.subscriberId);
          return Promise.all(subscriberIds.map((id) => userLoader.load(id)));
        }
        return subscribedToUserLoader.load(parent.id);
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
      resolve: async (
        _: unknown,
        __: unknown,
        context: Context,
        info: GraphQLResolveInfo,
      ) => {
        const { prisma, userLoader } = context;

        // Determine which subscription relations to include based on requested fields
        const includeUserSubscribedTo = shouldIncludeField(info, 'userSubscribedTo');
        const includeSubscribedToUser = shouldIncludeField(info, 'subscribedToUser');

        // Build include options for subscription data
        const includeOptions: Record<string, boolean> = {};
        if (includeUserSubscribedTo) {
          includeOptions.userSubscribedTo = true;
        }
        if (includeSubscribedToUser) {
          includeOptions.subscribedToUser = true;
        }

        // Fetch users with subscription data if needed
        const users = (await prisma.user.findMany({
          ...(Object.keys(includeOptions).length > 0 && { include: includeOptions }),
        })) as UserWithSubscriptions[];

        // Prime the user loader cache with fetched users
        users.forEach((user) => {
          userLoader.prime(user.id, user);
        });

        return users;
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
