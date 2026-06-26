<script setup>
import DashboardLayout from './DashboardLayout.vue';
const props = defineProps({ title:String, subtitle:String });
</script>
<template>
  <DashboardLayout :title="title" :subtitle="subtitle">
    <template #nav><slot name="nav" /></template>
    <slot />
  </DashboardLayout>
</template>
