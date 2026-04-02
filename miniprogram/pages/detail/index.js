// pages/detail/index.js
const app = getApp();
const DB_NAME = "guests";

Page({
  data: {
    guestId: "",
    guest: {},
    recordList: [],
    isEditing: false,
    selectedRecords: [],
    isAllSelected: false,
    visitCount: 0,
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

      // 保存原始 visitHistory 的深拷贝，用于删除时对比
      const originalVisitHistory = JSON.parse(JSON.stringify(guest.visitHistory || []));

      // 合并光临记录和奖励记录
      const recordList = this.mergeRecords(guest);
      const visitCount = recordList.filter(r => r.type === 'visit').length;

      // 为每条记录添加索引和选中状态
      const recordListWithIndex = recordList.map((item, index) => ({
        ...item,
        index: index,
        selected: false,
      }));

      this.setData({
        guest: guest,
        recordList: recordListWithIndex,
        visitCount: visitCount,
        originalVisitHistory: originalVisitHistory,
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
      guest.visitHistory.forEach((visit, idx) => {
        const timeStr = visit.timeStr || visit.time;
        records.push({
          type: "visit",
          timeStr: timeStr,
          sortTime: this.parseTime(timeStr),
          visitIndex: idx,
        });
      });
    }

    // 添加奖励记录
    if (guest.rewardHistory && guest.rewardHistory.length > 0) {
      guest.rewardHistory.forEach((reward, idx) => {
        const timeStr = reward.timeStr || reward.time;
        records.push({
          type: "reward",
          timeStr: timeStr,
          sortTime: this.parseTime(timeStr),
          rewardIndex: idx,
        });
      });
    }

    // 按时间倒序排列
    records.sort((a, b) => {
      const timeA = a.sortTime || 0;
      const timeB = b.sortTime || 0;
      return timeB - timeA;
    });

    return records;
  },

  // 解析时间字符串
  parseTime(timeStr) {
    if (!timeStr) return 0;
    if (typeof timeStr === "object") {
      return timeStr.getTime ? timeStr.getTime() : new Date(timeStr).getTime();
    }

    // 先尝试直接转 Date
    const directDate = new Date(timeStr);
    if (!isNaN(directDate.getTime())) {
      return directDate.getTime();
    }

    // 格式: YYYY-MM-DD 周几 HH:mm
    const match = timeStr.match(/(\d{4})-(\d{2})-(\d{2})\s+(\S+)\s+(\d{2}):(\d{2})/);
    if (match) {
      return new Date(
        parseInt(match[1]),
        parseInt(match[2]) - 1,
        parseInt(match[3]),
        parseInt(match[5]),
        parseInt(match[6])
      ).getTime();
    }

    // 尝试匹配简单格式: YYYY-MM-DD HH:mm
    const simpleMatch = timeStr.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    if (simpleMatch) {
      return new Date(
        parseInt(simpleMatch[1]),
        parseInt(simpleMatch[2]) - 1,
        parseInt(simpleMatch[3]),
        parseInt(simpleMatch[4]),
        parseInt(simpleMatch[5])
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

  // 进入编辑模式
  enterEditMode() {
    // 清除所有选中状态
    const recordList = this.data.recordList.map((item) => ({
      ...item,
      selected: false,
    }));

    this.setData({
      isEditing: true,
      recordList,
      selectedRecords: [],
      isAllSelected: false,
    });
  },

  // 退出编辑模式
  exitEditMode() {
    this.setData({
      isEditing: false,
      selectedRecords: [],
    });
  },

  // 更新选择状态
  updateSelectStatus(recordList) {
    const selectedRecords = [];
    recordList.forEach((item, index) => {
      if (item.selected) {
        selectedRecords.push(index);
      }
    });
    const visitCount = this.data.visitCount;
    const visitSelectedCount = recordList.filter((item) => item.selected && item.type === 'visit').length;
    const isAllSelected = visitCount > 0 && visitSelectedCount === visitCount;
    this.setData({
      recordList,
      selectedRecords,
      isAllSelected,
    });
  },

  // 切换记录选中状态
  toggleRecordSelect(e) {
    const index = e.currentTarget.dataset.index;
    const recordList = [...this.data.recordList];
    const record = recordList[index];

    recordList[index] = {
      ...record,
      selected: !record.selected,
    };

    this.updateSelectStatus(recordList);
  },

  // 全选/取消全选光临记录
  toggleSelectAll() {
    const { recordList, isAllSelected } = this.data;
    const newRecordList = recordList.map((item) => {
      if (item.type === 'visit') {
        return {
          ...item,
          selected: !isAllSelected,
        };
      }
      return item;
    });

    this.updateSelectStatus(newRecordList);
  },

  // 批量删除选中的光临记录
  async batchDeleteVisits() {
    const { selectedRecords } = this.data;
    if (selectedRecords.length === 0) {
      wx.showToast({
        title: "请先选择要删除的记录",
        icon: "none",
      });
      return;
    }

    wx.showModal({
      title: "确认删除",
      content: `确定要删除选中的 ${selectedRecords.length} 条光临记录吗？`,
      confirmColor: "#e54545",
      success: async (res) => {
        if (res.confirm) {
          await this.doBatchDeleteVisits();
        }
      },
    });
  },

  // 执行批量删除
  async doBatchDeleteVisits() {
    const { recordList, guestId } = this.data;
    try {
      wx.showLoading({ title: "删除中..." });
      const db = app.db;

      // 获取选中的光临记录索引
      const toDeleteVisitIndices = recordList
        .filter((item) => item.selected && item.type === 'visit' && item.visitIndex !== undefined)
        .map((item) => item.visitIndex);

      // 获取选中的奖励记录索引
      const toDeleteRewardIndices = recordList
        .filter((item) => item.selected && item.type === 'reward' && item.rewardIndex !== undefined)
        .map((item) => item.rewardIndex);

      console.log("要删除的光临索引:", toDeleteVisitIndices);
      console.log("要删除的奖励索引:", toDeleteRewardIndices);

      // 获取最新数据
      const guestRes = await db.collection(DB_NAME).doc(guestId).get();
      const currentGuest = guestRes.data;
      const visitHistory = currentGuest.visitHistory || [];
      const rewardHistory = currentGuest.rewardHistory || [];

      // 构建新的 visitHistory
      const newVisitHistory = visitHistory.filter((_, idx) => !toDeleteVisitIndices.includes(idx));
      // 构建新的 rewardHistory
      const newRewardHistory = rewardHistory.filter((_, idx) => !toDeleteRewardIndices.includes(idx));

      // 计算删除数量
      const deleteVisitCount = toDeleteVisitIndices.length;
      const deleteRewardCount = toDeleteRewardIndices.length;
      console.log(`删除光临${deleteVisitCount}条, 奖励${deleteRewardCount}条`);

      // 更新数据库
      const updateData = {
        updateTime: db.serverDate(),
      };

      if (deleteVisitCount > 0) {
        updateData.visitHistory = newVisitHistory;
        updateData.totalCount = Math.max(0, (currentGuest.totalCount || 0) - deleteVisitCount);
        updateData.currentCount = Math.max(0, (currentGuest.currentCount || 0) - deleteVisitCount);
      }

      if (deleteRewardCount > 0) {
        updateData.rewardHistory = newRewardHistory;
        updateData.rewardCount = Math.max(0, (currentGuest.rewardCount || 0) - deleteRewardCount);
      }

      await db.collection(DB_NAME).doc(guestId).update({
        data: updateData,
      });

      wx.showToast({
        title: "删除成功",
        icon: "success",
      });

      // 重新加载
      await this.loadGuestDetail();
      this.exitEditMode();
    } catch (e) {
      console.error("删除失败", e);
      wx.showToast({
        title: "删除失败",
        icon: "none",
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 显示批量添加对话框
  showAddBatchModal() {
    wx.showModal({
      title: "批量增加光临次数",
      editable: true,
      placeholderText: "请输入增加次数",
      content: "",
      success: async (res) => {
        if (res.confirm) {
          const count = parseInt(res.content) || 1;
          if (count < 1) {
            wx.showToast({
              title: "请输入有效次数",
              icon: "none",
            });
            return;
          }
          await this.addBatchVisits(count);
        }
      },
    });
  },

  // 批量增加光临记录
  async addBatchVisits(count) {
    const { guestId } = this.data;
    try {
      wx.showLoading({ title: "添加中..." });
      const db = app.db;

      const now = new Date();
      const newVisits = [];
      for (let i = 0; i < count; i++) {
        newVisits.push({
          time: db.serverDate(),
          timeStr: this.formatDate(now),
        });
      }

      // 使用和首页一样的方式更新
      await db.collection(DB_NAME).doc(guestId).update({
        data: {
          currentCount: db.command.inc(count),
          totalCount: db.command.inc(count),
          visitHistory: db.command.unshift(newVisits),
          updateTime: db.serverDate(),
        },
      });

      wx.showToast({
        title: `已添加${count}次`,
        icon: "success",
      });

      await this.loadGuestDetail();
    } catch (e) {
      console.error("添加失败", e);
      wx.showToast({
        title: "添加失败",
        icon: "none",
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 手动发放奖励
  async giveReward() {
    const { guestId, guest } = this.data;

    wx.showModal({
      title: "确认发放奖励",
      content: `确定给「${guest.name}」发放奖励吗？`,
      success: async (res) => {
        if (res.confirm) {
          await this.doGiveReward();
        }
      },
    });
  },

  // 执行发放奖励
  async doGiveReward() {
    const { guestId } = this.data;
    try {
      wx.showLoading({ title: "发放中..." });
      const db = app.db;

      // 记录奖励发放时间
      const now = new Date();
      const newReward = {
        time: db.serverDate(),
        timeStr: this.formatDate(now),
      };

      // 发放奖励：奖励次数+1
      await db.collection(DB_NAME).doc(guestId).update({
        data: {
          rewardCount: db.command.inc(1),
          rewardHistory: db.command.unshift(newReward),
          updateTime: db.serverDate(),
        },
      });

      wx.showToast({
        title: "奖励发放成功",
        icon: "success",
      });

      await this.loadGuestDetail();
    } catch (e) {
      console.error("发放奖励失败", e);
      wx.showToast({
        title: "发放失败",
        icon: "none",
      });
    } finally {
      wx.hideLoading();
    }
  },
});
