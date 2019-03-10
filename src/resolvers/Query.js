const {forwardTo} = require('prisma-binding');

const Query = {

    //GET ALL BOOKS
    async getAllBooks(parent,args,ctx,info){
        return await ctx.db.query.books({
            where : {active:true},
            orderBy: 'sku_DESC'
        },`{
            id
            title
            author
            dateTime
            publisher {
                name
                discount
            }
            category{
                name
            }
            type {
                name
            }
            images {
                src
            }
            mrp
            sku
        }`);
        
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
        return await ctx.db.query.category({
            where: {id: args.id}
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
    }

}

module.exports = Query;