<script setup>
import DashboardLayout from './DashboardLayout.vue';
defineProps({ title:String, subtitle:String, hideUserPill:Boolean, hideSidebar:Boolean });
</script>
<template>
  <DashboardLayout :title="title" :subtitle="subtitle" :hide-user-pill="hideUserPill" :hide-sidebar="hideSidebar" shell-class="veterinarian-theme">
    <template #nav><slot name="nav" /></template>
    <template #top-actions><slot name="top-actions" /></template>
    <slot />
  </DashboardLayout>
</template>
