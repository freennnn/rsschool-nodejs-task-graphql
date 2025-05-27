import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { graphql, GraphQLSchema, GraphQLObjectType, validate, parse } from 'graphql';
import depthLimit from 'graphql-depth-limit';
import {
  rootResolvers,
  UserType,
  ProfileType,
  PostType,
  MemberTypeType,
  createLoaders,
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

      // Parse the query
      const document = parse(query);

      // Validate with depth limit
      const validationErrors = validate(schema, document, [depthLimit(5)]);

      if (validationErrors.length > 0) {
        return {
          errors: validationErrors.map((error) => ({
            message: error.message,
            locations: error.locations,
            path: error.path,
          })),
        };
      }

      // Create fresh DataLoaders for each request
      const loaders = createLoaders(prisma);

      return graphql({
        schema,
        source: query,
        variableValues: variables,
        contextValue: { prisma, ...loaders }, // Pass prisma client and loaders in context
      });
    },
  });
};

export default plugin;
