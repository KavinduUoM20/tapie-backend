import User from "../models/User.js";
import FriendRequest from "../models/FriendRequest.js";

export async function getRecommendedUsers(req,res) {
    try {
        const currentUserId = req.user.id;
        const currentUser = req.user;

        const recommendedUsers = await User.find({
            $and: [
                { _id: { $ne: currentUserId } },
                {$id: { $nin: currentUser.friends }},
                { isOnboarded: true }
            ]
        });

        res.status(200).json(recommendedUsers);
    } catch (error) {
        console.error("Error getting recommended users:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function getMyFriends(req,res) {
    try {
        const user = await User.findById(req.user.id).select("friends").populate("friends", "fullName profilePic nativeLang learningLang");
        res.status(200).json(user.friends);
    } catch (error) {
        console.error("Error getting my friends:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function sendFriendRequest(req,res) {
    try {
        const myId = req.user.id;
        const {id:recipientId} = req.params;

        // prevent sending friend request to yourself
        if(myId === recipientId) return res.status(400).json({message: "You cannot send a friend request to yourself"});

        const recipient = await User.findById(recipientId);
        // prevent sending friend request to a user that doesn't exist
        if(!recipient) return res.status(404).json({message: "User not found"});

        // prevent sending friend request to a user that is already friends with you
        if(recipient.friends.includes(myId)) return res.status(400).json({message: "You are already friends with this user"});

        // prevent sending duplicate friend requests
        const existingRequest = await FriendRequest.findOne({
            $or : [
                {sender: myId, recipient: recipientId},
                {sender: recipientId, recipient: myId}
            ]
        });

        if(existingRequest) return res.status(400).json({message: "You have already sent a friend request to this user"});

        const friendRequest = await FriendRequest.create({
            sender: myId,
            recipient: recipientId
        });

        res.status(200).json(friendRequest);
    } catch (error) {
        console.error("Error sending friend request:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function acceptFriendRequest(req,res) {
    try {
        const {id:requestId} = req.params;
        const friendRequest = await FriendRequest.findById(requestId);

        if(!friendRequest) return res.status(404).json({message: "Friend request not found"});  

        if(friendRequest.recipient.toString() !== req.user.id) return res.status(401).json({message: "You are not authorized to accept this friend request"});

        friendRequest.status = "accepted";
        await friendRequest.save();

        await User.findByIdAndUpdate(friendRequest.sender, {
            $addToSet: {friends: friendRequest.recipient},
        });

        await User.findByIdAndUpdate(friendRequest.recipient, {
            $addToSet: {friends: friendRequest.sender},
        });

        res.status(200).json({message: "Friend request accepted successfully"});
    }catch{
        console.error("Error accepting friend request:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}


export async function getFriendRequests(req,res) {
    try {
        const incomingRequests = await FriendRequest.find({
            recipient: req.user.id,
            status: "pending"
        }).populate("sender", "fullName profilePic nativeLang learningLang");
        
        const acceptedRequests = await FriendRequest.find({
            recipient: req.user.id,
            status: "accepted"
        }).populate("sender", "fullName profilePic nativeLang learningLang");
        
        res.status(200).json({incomingRequests, acceptedRequests});

    } catch (error) {
        console.error("Error getting friend requests:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function getOutgoingFriendRequests(req, res){
    try {
        const outgoingRequests = await FriendRequest.find({
        sender: req.user.id,
        status: "pending",
        }).populate("recipient", "fullName profilePic nativeLanguage learningLanguage");
    
        res.status(200).json(outgoingRequests);
    } catch (error) {
        console.log("Error getting outgoing friend requests:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}