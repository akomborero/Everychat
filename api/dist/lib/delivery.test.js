"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const delivery_1 = require("./delivery");
(0, node_test_1.default)("moves forward", () => { strict_1.default.equal((0, delivery_1.nextDeliveryStatus)(null, "sent"), "sent"); strict_1.default.equal((0, delivery_1.nextDeliveryStatus)("sent", "delivered"), "delivered"); strict_1.default.equal((0, delivery_1.nextDeliveryStatus)("delivered", "read"), "read"); });
(0, node_test_1.default)("skipped steps are fine", () => strict_1.default.equal((0, delivery_1.nextDeliveryStatus)(null, "read"), "read"));
(0, node_test_1.default)("never moves backwards", () => { strict_1.default.equal((0, delivery_1.nextDeliveryStatus)("read", "delivered"), null); strict_1.default.equal((0, delivery_1.nextDeliveryStatus)("delivered", "sent"), null); strict_1.default.equal((0, delivery_1.nextDeliveryStatus)("sent", "sent"), null); });
(0, node_test_1.default)("failure applies only before delivery", () => { strict_1.default.equal((0, delivery_1.nextDeliveryStatus)("sent", "failed"), "failed"); strict_1.default.equal((0, delivery_1.nextDeliveryStatus)(null, "failed"), "failed"); strict_1.default.equal((0, delivery_1.nextDeliveryStatus)("delivered", "failed"), null); strict_1.default.equal((0, delivery_1.nextDeliveryStatus)("read", "failed"), null); });
(0, node_test_1.default)("failed is final", () => strict_1.default.equal((0, delivery_1.nextDeliveryStatus)("failed", "delivered"), null));
(0, node_test_1.default)("unknown and prototype keys are ignored", () => { strict_1.default.equal((0, delivery_1.nextDeliveryStatus)("sent", "deleted"), null); strict_1.default.equal((0, delivery_1.nextDeliveryStatus)("sent", "constructor"), null); });
