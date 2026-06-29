<script setup>
import DashboardLayout from './DashboardLayout.vue';
const props = defineProps({ title:String, subtitle:String, hideUserPill:Boolean });
</script>
<template>
  <DashboardLayout :title="title" :subtitle="subtitle" :hide-user-pill="hideUserPill">
    <template #nav><slot name="nav" /></template>
    <template #top-actions><slot name="top-actions" /></template>
    <slot />
  </DashboardLayout>
</template>
