import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { graphql, GraphQLSchema, GraphQLObjectType } from 'graphql';
import {
  rootResolvers,
  UserType,
  ProfileType,
  PostType,
  MemberTypeType,
} from './types/user.js';
import { UUIDType } from './types/scalars.js';
import { createGqlResponseSchema, gqlResponseSchema } from './schemas.js';
// PrismaClient import might be needed if not already available via fastify instance
// import { PrismaClient } from '@prisma/client';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  // Assuming prisma is decorated on fastify instance, otherwise instantiate here
  const { prisma } = fastify;

  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'RootQueryType',
      fields: rootResolvers.Query,
    }),
    mutation: new GraphQLObjectType({
      name: 'Mutations',
      fields: rootResolvers.Mutation,
    }),
    types: [UserType, ProfileType, PostType, MemberTypeType, UUIDType],
  });

  fastify.route({
    url: '/',
    method: 'POST',
    schema: {
      ...createGqlResponseSchema,
      response: {
        200: gqlResponseSchema,
      },
    },
    async handler(req) {
      const { query, variables } = req.body;
      return graphql({
        schema,
        source: query,
        variableValues: variables,
        contextValue: { prisma }, // Pass prisma client in context
      });
    },
  });
};

export default plugin;
