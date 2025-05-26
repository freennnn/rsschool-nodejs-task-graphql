import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createGqlResponseSchema, gqlResponseSchema } from './schemas.js';
import { graphql, GraphQLSchema, GraphQLObjectType } from 'graphql';
import { userResolvers } from './types/user.js';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { prisma } = fastify;

  // Create schema
  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'RootQueryType',
      fields: {
        ...userResolvers.Query,
      },
    }),
    mutation: new GraphQLObjectType({
      name: 'Mutations',
      fields: {
        ...userResolvers.Mutation,
      },
    }),
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
        contextValue: { prisma },
      });
    },
  });
};

export default plugin;
