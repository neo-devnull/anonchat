<template>
<section v-if="connected == 3" class='chat'>
   <div class='msgs'>
       <div class='text'>
        <p v-for="msg in msgs">{{msg}}</p>       
        </div>
    </div>
    <div class='send'>        
        <textarea v-model="message">{{message}}</textarea>         
        <input @click='sendMessage' type='submit' value='Send message'>
        <input @click='endChat' type='submit' value='End Chat!'>        
    </div>
</section>


<section v-else-if="connected == 2" class='chat'>
   <div class='msgs'>
       <div class='text'>
        <p v-for="msg in msgs">{{msg}}</p>       
        </div>
    </div>
    <div class='send'>        
        <textarea v-model="message">{{message}}</textarea>         
        <input @click='restartChat' type='submit' value="Start new chat"/>
        <input @click='manageInterests' type='submit' value="Manage Interests"/>        
    </div>
</section>

<section v-else-if="connected == 1" class='chat'>
    <div class='msgs'>
        <center> Searching ... </center>
    </div>
</section>

<section v-else class='chat'>
    <div class='msgs'>
       <center> 
           Type an interest : <input  v-on:keyup.enter='goChat' v-model="interest" type='text' />
            <input @click='goChat' type='submit' value='Go!'>            
         </center>
    </div>
</section>
</template>

<script>
const socketio = require('socket.io-client');
module.exports = {
    mounted(){
        this.socket.on('searching',(data) => {        
            this.connected = 1;
        });

        this.socket.on('newMessage',(data) => {
            if(data.from == this.socket.id){
                this.msgs.push('You : '+data.msg)
            } else {
                this.msgs.push('Partner : '+data.msg)
            }
        });

        this.socket.on('joinRequest',(data) => {
            this.socket.emit('joinAccept',data);
        });

        this.socket.on('leaveRequest',(data) => {
            console.log("leave request received");
            if(data.initiator == this.socket.id){
                this.msgs.push('You have ended the chat');
            } else {
                this.msgs.push('Your partner has ended chat');
            }
            this.socket.emit('leaveAccept',data.room);
        })

        this.socket.on('chatEnded',(data) => {
            console.log('Chat ended');
            this.connected = 2;
        });

        this.socket.on('chatStarted',(data) => {
            this.connected = 3;
            this.msgs = [];
            this.msgs.push('You have a partner. You both like '+data.join(','));
        });
    },
    data : function(){
        return {
            socket : socketio('http://anonchat.local:3001'),
            message : '',
            msgs : [],
            connected : 0,
            room : null,
            interest : ''
        }
    },
    methods : {
        sendMessage(e){
            e.preventDefault();
            this.socket.emit('sendMessage',this.message);
            this.message = '';
        },

        goChat(e){
            if(this.interest.length == 0) return;
            interests = this.interest.split(",");            
            this.socket.emit('goChat',interests);            
        },

        endChat(e){
            e.preventDefault();
            this.socket.emit('endChat');
        },

        restartChat(e){
            e.preventDefault();
            interests = this.interest.split(",");            
            this.socket.emit('restartChat');
        },

        manageInterests(e){
            this.connected = 0;
        }

    }
}
/**
 * Connected -> 0 = Disconnected from pool, 1 = In pool searching, 2 = In pool chat ended, 3 = In chat
 */
</script>