//IMPORT LIBRARIES
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {randomBytes} = require('crypto');
const axios = require('axios');

//IMPORT UTIL FUNCTIONS
const calcTotalPrice = require('./calcTotalPrice');
const {getOrderProductObjectForMail} = require('./utilFunctions');

const Mutation = {

    //CREATE CATEGORY MUTATION
    async createCategory(parent,args,ctx,info){
        const name = await ctx.db.query.category({
            where: {name: args.name.toLowerCase()}
        });
        if(name) throw new Error("This category already exist!!");
        const res = await ctx.db.mutation.createCategory({
            data: {
                name : args.name.toLowerCase()
            }
        });
        if(!res) throw new Error("Something Went Wrong");
        return {message: "Category Created Successfully!!"}
    },

    //CREATE TYPE MUTATION
    async createType(parent,args,ctx,info){
        const name = await ctx.db.query.type({
            where: {name: args.name.toLowerCase()}
        });
        if(name) throw new Error("This category already exist!!");
        const category = await ctx.db.query.category({
            where : {name: args.category.toLowerCase()}
        });
        if(!category) throw new Error("You provide unknown category");
        const res = await ctx.db.mutation.createType({
            data: {
                name : args.name.toLowerCase(),
                category: {connect: {id: category.id}}
            }
        });
        if(!res) throw new Error("Something Went Wrong");
        return {message: "Type " + args.name +  " Created Successfully!!"}
    },

    //CREATE PUBLISHER MUTATION
    async createPublisher(parent,args,ctx,info){
        const name = await ctx.db.query.publisher({
            where: {name: args.name.toLowerCase()}
        },info);
        if(name) throw new Error("This publisher already exist!!");
        const type = await ctx.db.query.type({
            where : {name: args.type.toLowerCase()}
        });
        if(!type) throw new Error("You provide unknown type");
        const res = await ctx.db.mutation.createPublisher({
            data: {
                name : args.name.toLowerCase(),
                type : {connect: {id: type.id}},
                discount: args.discount
            }
        });
        if(!res) throw new Error("Something Went Wrong");
        return {message: "Publisher " + args.name +  " Created Successfully!!"}
    },

    //CREATE BOOK MUTATION
    async createBook(parent,args,ctx,info){
        const slug = await ctx.db.query.book({
            where : {slug: args.slug}
        },info); 

        if(slug) throw new Error("Slug Already Exist");

        if(args.images.length<1) throw new Error("Upload Image is Must");

        var lastSKU = await ctx.db.query.books({last:1});
        if(lastSKU.length==0){
            var sku = 1000;
        }else{
            var lastSKU = lastSKU[0].sku;
            var sku = lastSKU + 1;
        }

        const publisher = await ctx.db.query.publisher({
            where: {name: args.publisher}
        });
        const type = await ctx.db.query.type({
            where: {name: args.type}
        });
        const category = await ctx.db.query.category({
            where: {name: args.category}
        });

        var tags = args.tags.map((tag)=>{
            return {text: tag}
        });

        var images = args.images.map((image)=>{
            return {src: image}
        })
        const book = await ctx.db.mutation.createBook({
            data: {
                sku: sku,
                title: args.title,
                author: args.author,
                category: {connect: {id: category.id}},
                publisher: {connect: {id: publisher.id}},
                type: {connect: {id: type.id}},
                subject: args.subject,
                edition: args.edition,
                active: true,
                quantity: args.quantity,
                detail: args.detail,
                description: args.description,
                mrp: parseInt(args.mrp),
                slug: args.slug,
                tags : {
                    create : tags
                },
                images : {
                    create: images
                },
                dateTime: new Date()
            }
        },info);
        
        return book;
    },

    async deleteBook(parent,args,ctx,info){

        //CHECK IF THAT BOOK EXIST
        const book = await ctx.db.query.book({
            where: {id:args.id}
        });
        if(!book) throw new Error("You passed wrong ID of book");

        const res = await ctx.db.mutation.deleteBook({
            where: {id: args.id}
        });
        if(!res) {
            console.log(book);
            throw new Error("Something went wrong");
        }
        return {message: "Book deleted successfully!!"}
    },

    async updateBook(parent,args,ctx,info){

        const book = await ctx.db.query.book({
            where: {id: args.id}
        });

        if(!book) throw new Error("Book Not Found!!"); 

        const publisher = await ctx.db.query.publisher({
            where: {name: args.publisher}
        });
        const type = await ctx.db.query.type({
            where: {name: args.type}
        });
        const category = await ctx.db.query.category({
            where: {name: args.category}
        });

        var tags = args.tags.map((tag)=>{
            return {text: tag}
        });

        var images = args.images.map((image)=>{
            return {src: image}
        })

        await ctx.db.mutation.deleteManyImages({
            where: {book: book}
        });

        await ctx.db.mutation.deleteManyTags({
            where: {book:book}
        });

        const updatedBook = await ctx.db.mutation.updateBook({
            data : {
                title: args.title,
                author: args.author,
                category: {connect: {id: category.id}},
                publisher: {connect: {id: publisher.id}},
                type: {connect: {id: type.id}},
                subject: args.subject,
                edition: args.edition,
                active: true,
                quantity: args.quantity,
                detail: args.detail,
                description: args.description,
                mrp: parseInt(args.mrp),
                slug: args.slug,
                tags : {
                    create : tags
                },
                images : {
                    create: images
                },
                dateTime: new Date()
            },
            where: {id: args.id}
        });

        if(!updatedBook) throw new Error("Book Updation Failed");

        return {message: "Book has been updated Successfully!!"}
    }

    

    

    
}

module.exports = Mutation;