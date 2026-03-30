// pages/detail/index.js
const app = getApp();
const DB_NAME = "guests";

Page({
  data: {
    guestId: "",
    guest: {},
    recordList: [],
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ guestId: options.id });
      this.loadGuestDetail();
    }
  },

  // 格式化日期
  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const h = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const w = weekdays[date.getDay()];
    return `${y}-${m}-${d} ${w} ${h}:${min}`;
  },

  // 加载客人详情
  async loadGuestDetail() {
    try {
      wx.showLoading({ title: "加载中..." });
      const db = app.db;
      const result = await db.collection(DB_NAME).doc(this.data.guestId).get();
      const guest = result.data;

      // 检查是否已删除
      if (guest.deleted) {
        wx.showToast({
          title: "该客人已被删除",
          icon: "none",
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
        return;
      }

      // 合并光临记录和奖励记录
      const recordList = this.mergeRecords(guest);

      this.setData({
        guest: guest,
        recordList: recordList,
      });
    } catch (e) {
      console.error("加载详情失败", e);
      wx.showToast({
        title: "加载失败",
        icon: "none",
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 合并记录
  mergeRecords(guest) {
    const records = [];

    // 添加光临记录
    if (guest.visitHistory && guest.visitHistory.length > 0) {
      guest.visitHistory.forEach((visit) => {
        records.push({
          type: "visit",
          timeStr: visit.timeStr || visit.time,
          sortTime: this.parseTime(visit.timeStr || visit.time),
        });
      });
    }

    // 添加奖励记录
    if (guest.rewardHistory && guest.rewardHistory.length > 0) {
      guest.rewardHistory.forEach((reward) => {
        records.push({
          type: "reward",
          timeStr: reward.timeStr || reward.time,
          sortTime: this.parseTime(reward.timeStr || reward.time),
        });
      });
    }

    // 按时间倒序排列
    records.sort((a, b) => b.sortTime - a.sortTime);
    return records;
  },

  // 解析时间字符串
  parseTime(timeStr) {
    if (!timeStr) return 0;
    if (typeof timeStr === "object") return timeStr.getTime();
    // 格式: YYYY-MM-DD HH:mm
    const match = timeStr.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    if (match) {
      return new Date(
        parseInt(match[1]),
        parseInt(match[2]) - 1,
        parseInt(match[3]),
        parseInt(match[4]),
        parseInt(match[5])
      ).getTime();
    }
    return 0;
  },

  // 预览头像大图
  previewAvatar(e) {
    const avatarUrl = e.currentTarget.dataset.avatar;
    if (!avatarUrl) {
      return;
    }
    wx.previewImage({
      urls: [avatarUrl],
      current: avatarUrl,
    });
  },
});
