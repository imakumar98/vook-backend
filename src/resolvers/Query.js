const {forwardTo} = require('prisma-binding');

const Query = {

    //GET ALL BOOKS
    async getAllBooks(parent,args,ctx,info){
        return await ctx.db.query.books({
            where : {active:true},
            orderBy: 'sku_DESC'
        },info);
        
    },

    //GET SINGLE BOOK BY ID
    async getSingleBook(parent,args,ctx,info){
        const book = await ctx.db.query.book({
            where : {id: args.id}
        },info);

        if(!book) throw new Error("Book Not Exist");
        
        return book;

    },

     //GET SINGLE BOOK BY SLUG
     async getSingleBookBySlug(parent,args,ctx,info){
        const book = await ctx.db.query.book({
            where : {slug: args.slug}
        },info);
        if(!book) throw new Error("Book Not Exist");
        return book;

    },

    async getTypesByCategory(parent,args,ctx,info){
        const category = await ctx.db.query.category({
            where: {name: args.name}
        },info);

        if(!category) throw new Error("Category Not Exist");

        const types = await ctx.db.query.types({
            where: {category: category}
        },info); 
        console.log(types);
        return types;
    },

    book: forwardTo('db'),
    order: forwardTo('db'),
    me(parent,args,ctx,info){
        if(!ctx.request.userId){
            return null;
        }
        return ctx.db.query.user({
            where: {id: ctx.request.userId},
        },`{
            id 
            name 
            email 
            walletBalance
            cart {
                id 
                quantity 
                book {
                    id
                    title
                    author
                    slug
                    publisher{
                        name
                        discount
                    }
                    mrp 
                    
                    images {
                        src
                    }
                }
            }
        }`);
    },

    //GET BOOK BY CATEGORY
    async getBooksByCategory(parent,args,ctx,info){
        console.log(args);
        return await ctx.db.query.category({
            where: {name: args.name}
        },info);
    },

    //GET ALL MY ORDERS
    async getMyOrders(parent,args,ctx,info){
        const {userId} = ctx.request; 
        const user = await ctx.db.query.user({
            where: {id: userId}
        });
        const orders = await ctx.db.query.orders({
            where: {user: user},
            orderBy: 'orderId_DESC'
        },info);
        console.log(orders);
        return orders;
    },

    //GET ALL BOOK CATEGORIES
    async getCategories(parent,args,ctx,info){
        return await ctx.db.query.categories({},info);
    },

    //GET ALL BOOK TYPES
    async getTypes(parent,args,ctx,info){
        return await ctx.db.query.types({},info);
    },

    //GET ALL BOOK PUBLISHERS
    async getPublishers(parent,args,ctx,info){
        return await ctx.db.query.publishers({},info);
    },

    //GET ALL ORDERS QUERY RESOLVER
    async getAllOrders(parent,args,ctx,info){
        return await ctx.db.query.orders({},info);
    }

}

module.exports = Query;