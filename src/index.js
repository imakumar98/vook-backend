//IMPORT MODULES
require('dotenv').load();
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { GraphQLServer } = require('graphql-yoga');

//IMPORT DB.JS  TO ACCESS QUERIES AND MUTATIONS
const db = require('./db');

//IMPORT QUERIES AND MUTATIONS
const Mutation = require('./resolvers/Mutation');
const Query = require('./resolvers/Query');


//CREATE SERVER
const server = new GraphQLServer({
    typeDefs: 'src/schema.graphql',
    resolvers: {
      Mutation,
      Query,
    },
    resolverValidationOptions: {
      requireResolversForResolveType: false,
    },
    context: req => ({ ...req, db }),
  });


//MIDDLEWARE TO USE COOKIE PARSER
server.express.use(cookieParser());

//MIDDLEWARE TO DECODE JWT TO GET USER ID ON EACH REQUEST
server.express.use((req,res,next)=>{
    const {token} = req.cookies;
    if(token){
        const {userId} = jwt.verify(token,process.env.TOKEN_SALT);
        
        //PUT THE USERID ONTO THE REQ FOR FUTURE REQUESTS TO ACCESS
        req.userId = userId; 
    }
    next();

});


// MIDDLEWARE TO POPULATES THE USER IN EACH REQUEST
server.express.use(async (req, res, next) => {
    
    //IF THEY ARE NOT LOGGED IN, SKIP THIS
    if (!req.userId) return next();
    const user = await db.query.user(
      { where: { id: req.userId } },
      '{ id, email, name }'
    );
    req.user = user;
    next();
  });


//RUN SERVER
server.start(
    {
      cors: {
        credentials: true,
        origin: process.env.FRONTEND_URL,
      },
    },
    deets => {
      console.log(`Server is now running on port http://localhost:${deets.port}`);
    }
);