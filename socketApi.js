/**
 * Before you dwell in here, i must warn you.
 * You might find that this is horrible code. Im a javascript novice.(I know thats no excuse)
 * This is merely a learning exercise. I just wanted to mess around with sockets, real time 
 * data exchanging. Nothing more nothing less. 
 * 
 * You will see that even though the code is messy, that it is very simplistic.
 * 
 * If at any point while you go through the code you start to hate me or wonder 
 * why in the hell im a developer, or a programmer or why i call myself either
 * of those terms(You can read my article on ego validation here -> jk)
 * i would not blame you. 
 * 
 * Anyhow, this project has been fun. 
 */

const socketApi = {};
const socketio = require('socket.io');
const io = socketio(3001);
const Datastore = require('nedb');
const db = new Datastore({filename: './users.db', autoload:true});
const db1 = new Datastore({filename: './partners.db', autoload:true});
const _ = require('lodash');
socketApi.io = io;

/**
 * Throw user into the search pool
 * @param {SocketId of the client} socketId 
 * @param {The interests of the client} clientInterests 
 */
socketApi.enterPool = function(socketId,clientInterests){
    return new Promise(function(resolve,reject){
        insert = {
            socketId : socketId,
            clientInterests : clientInterests,
            available : 1
        };
        query = { socketId : socketId }
        options = {upsert:true,returnUpdatedDocs:true}
        console.log(query);
        db.update(query,insert,options,function(err,rows,data){            
            if(err) reject(err);
            console.log("Undefined is here");
            console.log(data);
            resolve(data);
        });
    });
}

socketApi.reenterPool = function(socketId){
    return new Promise(function(resolve,reject){
        query = {socketId:socketId};
        update = {$set:{available:1}}
        db.update(query,update,{returnUpdatedDocs:true},function(err,rows,data){
            if(err) reject(err);
            resolve(data);
        })
    })
}

/**
 * Search the pool for clients with matching interests
 * @param {Users socket id and interests} data 
 */
socketApi.searchPool = function(data){    
    return new Promise(function(resolve,reject){
        query = {
            socketId : {
                $ne : data.socketId
            },
            available : {
                $ne : 0
            },
            clientInterests : {
                $in : data.clientInterests
            }
        }        
        db.find(query,function(err,match){
            if(err) reject(err)            
            if(match.length > 0){
                //Is there no native function to find the intersection of 2 arrays?
                commonInterests = _.intersection(data.clientInterests,match[0].clientInterests);
                partners = {
                    socketId1 : data.socketId,
                    socketId2 : match[0].socketId,
                    commonInterests : commonInterests
                },
                resolve(partners);
            } else {
                reject('NO_MATCH');
            }
        })
    });
}

/**
 * Search if a client is in the pool
 * @param {Socket id of client} socketId 
 */
socketApi.isInPool = function(socketId){
    return new Promise(function(resolve,reject){
        db.count({socketId:socketId},function(err,count){
            if(count > 0){
                resolve(1);
            } else {
                reject(0);
            }            
        })
    })
}

/**
 * Create a new chat with 2 matched clients 
 * @param {The socket id of 2 clients and their matching interests} data 
 */
socketApi.createChat = function(data){
    return new Promise(function(resolve,reject){
        insert = {
            partners : [data.socketId1, data.socketId2],
            commonInterests : data.commonInterests            
        }        
        db1.insert(partners,function(err,data){
            if(err) reject(err);
            query = {
                $or : [
                    {socketId:data.socketId1},
                    {socketId:data.socketId2}
                ]
            }
            db.update(query,{$set:{available:0}},{multi:true},function(err,rows){
                if(err) reject(err);
                room = data._id;
                io.to(data.socketId1).emit('joinRequest',room);
                io.to(data.socketId2).emit('joinRequest',room);            
                resolve(1);
            });

        });
    })
}

/**
 * End chat for both parties, since one has decided to end the chat
 * @param {*} socketId 
 */
socketApi.endChat = function(data){
    return new Promise(function(resolve,reject){
        emit = {
            room: data.partners._id,
            initiator: data.initiator
        }
        io.to(data.partners.socketId1).emit('leaveRequest',emit)
        io.to(data.partners.socketId2).emit('leaveRequest',emit)   
        resolve(1);     
    }); 
}

/**
 * Find the room a client is inside
 * @param {The socket id of a client} socketId 
 * @param {If roomOnly is 1, only the room is sent back} roomOnly
 */
socketApi.findPartnerInfo = function(socketId,roomOnly=0){
    return new Promise(function(resolve,reject){
        query = {
            $or : [
                { socketId1 : socketId },
                { socketId2 : socketId }
            ]
        }        
        db1.find(query,function(err,rows){
            if(err) reject(err);
            if(rows.length == 0){
                reject('NO_PARTNER');               
            }            
            if(!roomOnly){
                resolve_data = { partners : rows[0], initiator : socketId}
            } else {
                resolve_data = rows[0]._id;
            }                        
            resolve(resolve_data);
        });        
    });
}



/**
 * Delete the room from database
 * @param {the room id} room 
 */
socketApi.clearRoom = function(room){
    return new Promise(function(resolve,reject){
        db1.count({_id:room},function(err,count){
            if(err) reject(err);
            /*
                If the room exists, delete it.
                If it does not, well, it was probably cleared by the first party that left the chat
            */
            if(count > 0){                
                db1.remove({_id:room},function(err,rem){
                    //console.log(err);
                    if(err) reject(err);
                    resolve(1);
                });
            } else {
                resolve(1);
            }
        })
    });
}


/**
 * A function that neatly ends the chat for the 2nd party, if the first party's 
 * session has abruptly disconnected
 * @param {socket id of client that has abburtpy ended his session} socketId 
 */
socketApi.abruptPatch = function(socketId){
    return new Promise(function(resolve,reject){
        socketApi.findPartnerInfo(socketId)
        .then(function(data){
            return socketApi.endChat(data);
        })
        .then(function(data){
            resolve(1);
        })
        .catch(function(err){
            if(err == 'NO_PARTNER') resolve(1);
            reject(err);
        })
    })
}

/**
 * Remove a client from the pool
 * @param {Socket id of client} socketId 
 */
socketApi.leavePool = function(socketId){
    return new Promise(function(resolve,reject){
        query = {socketId:socketId};
        db.remove(query,{},function(err,rem){
            if(err) reject(err);
            resolve(1);
        })
    })
}


io.on('connection',function(socket){
    console.log("User has connected. Socket ID :"+socket.id)    
    socket.on('goChat',function(clientInterests){
        socket.emit('searching');        
        return socketApi.enterPool(socket.id,clientInterests)
        .then(function(data){
            return socketApi.searchPool(data);
        })
        .then(function(partners){
            return socketApi.createChat(partners)
        })
        .catch(function(err){
            if(err == 'NO_MATCH'){
                //console.log('no match was found');
            } else {
                //console.log(err);
            }
        })
    });

    socket.on('restartChat',function(){
        socket.emit('searching');
        return socketApi.reenterPool(socket.id)
        .then(function(data){
            return socketApi.searchPool(data);
        })
        .then(function(partners){
            return socketApi.createChat(partners)
        })
        .catch(function(err){
            if(err == 'NO_MATCH'){
                console.log('No match found');
            } else {

            }
        })
    })

    socket.on('joinAccept',function(room){
        /*
            We do this query to find out the commonInterests. If the app lacked this feature 
            we could just join with the functions initial parameter
        */
        db1.find({_id:room},function(err,data){
            socket.join(room);
            socket.emit('chatStarted',data[0].commonInterests);
        });
    });

    socket.on('leaveAccept',function(room){        
        return socketApi.clearRoom(room)
        .then(function(){
            console.log("we are emitting chat end");
            socket.emit('chatEnded');
        })
        .catch(function(err){
            //console.log(err)
        });
    });

    socket.on('endChat',function(){
        return socketApi.findPartnerInfo(socket.id)
        .then(function(partners){
            return socketApi.endChat(partners);
        })
        .catch(function(err){
            //console.log(err);
        })
    });

    socket.on('sendMessage',function(msg){
        return socketApi.findPartnerInfo(socket.id,1)
        .then(function(room){
            emit = { from : socket.id, msg : msg}
            io.to(room).emit('newMessage',emit);
        })
    });

    socket.on('disconnect',function(){
        console.log("User has disconnected. Socket ID :"+socket.id)    
        return socketApi.isInPool(socket.id)
        .then(function(data){
            return socketApi.abruptPatch(socket.id)
        })        
       .then(function(data){            
            return socketApi.leavePool(socket.id);
       })
       .catch(function(data){
           //Do nothing
           //Im so bad at javascript but fuck it?           
       })
    })
})

module.exports = socketApi;