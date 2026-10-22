const amqp = require("amqplib");

const QUEUE = "image_processing";
let connectionPromise;
let channelPromise;

async function getConfirmChannel() {
    if (!connectionPromise) {
        connectionPromise = amqp.connect(process.env.RABBITMQ_URL)
            .catch((error) => {
                connectionPromise = null;
                throw error;
            });
    }

    const connection = await connectionPromise;

    if (!channelPromise) {
        channelPromise = connection.createConfirmChannel()
            .then(async (channel) => {
                await channel.assertQueue(QUEUE, { durable: true });
                return channel;
            })
            .catch((error) => {
                channelPromise = null;
                throw error;
            });
    }

    return channelPromise;
}

async function publishImageTask(task) {
    const channel = await getConfirmChannel();
    channel.sendToQueue(
        QUEUE,
        Buffer.from(JSON.stringify(task)),
        { persistent: true, contentType: "application/json" }
    );
    await channel.waitForConfirms();
}

module.exports = { publishImageTask, QUEUE };
